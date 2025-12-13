const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 3000

// middil were 
app.use(express.json())
app.use(cors({
  origin: [process.env.CLIENT_DOMEN],
  credentials: true
}));


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5wfdugv.mongodb.net/?appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("etuitor_db")

    const tuitionscollection = db.collection('tuitions')
    // tuitor db 
    const applicationsCollection = db.collection('applications');
    // payment history db
    const paymentHistoryCollection = db.collection('paymentHistory');
    const usercollection = db.collection('user')


    // Tuitions save new post api theke ne a astise 
    app.get('/tuitions', async (req, res) => {
      const { email } = req.query;

      let query = {};
      if (email) {
        query = { "student.email": email };
      }

      const result = await tuitionscollection.find(query).toArray();
      res.send(result);
    });

    //  add student addnew post 
    app.post('/tuitions', async (req, res) => {
      const tuition = req.body
      const result = await tuitionscollection.insertOne(tuition)
      res.send(result)
    })

    // Tuitions delete
    app.delete('/tuitions/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await tuitionscollection.deleteOne(query)
      res.send(result)
    })


    //  edite TUITIONS kora lagbe 
    // app. 




    //  tuitor application // tuitor db 
    app.post('/applications', async (req, res) => {
      const application = req.body;

      const result = await applicationsCollection.insertOne({
        ...application,
        status: 'pending',
        appliedAt: new Date()
      });

      res.send(result);
    });


    // student dash bord a show hobe // tuitor db 
    app.get('/applications/student/:email', async (req, res) => {
      const email = req.params.email;

      const result = await applicationsCollection
        .find({ studentEmail: email })
        .toArray();

      res.send(result);

    });


    // reject application 
    app.patch('/applications/reject/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status: "rejected" }
      };
      const result = await applicationsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    //  PAYMENT
    // payment in // tuitor db 
    app.post('/create-checkout-session', async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo)
      // res.send(paymetInfo)
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: paymentInfo?.name,
              },
              unit_amount: paymentInfo?.price * 100,
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo?.studentEmail,
        mode: 'payment',
        metadata: {
          applicationId: paymentInfo?.applicationId,
          tutorEmail: paymentInfo?.tutorEmail,
          subject: paymentInfo?.subject,
          coustomer: paymentInfo?.coustomer
        },
        success_url: `${process.env.CLIENT_DOMEN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_DOMEN}/dashboard/applied-tutors`,
      })
      res.send({ url: session.url })
    })

    // payment success 
    app.post('/payment-success', async (req, res) => {
      const { sessionId } = req.body;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const applicationId = session.metadata.applicationId;

      // 1️⃣ Update application status (একবারই)
      await applicationsCollection.updateOne(
        { _id: new ObjectId(applicationId) },
        { $set: { status: "approved" } }
      );

      // 2️⃣ Prevent duplicate insert in paymentHistory
      const exists = await paymentHistoryCollection.findOne({ applicationId });
      if (!exists) {
        await paymentHistoryCollection.insertOne({
          applicationId: applicationId,
          tutorEmail: session.metadata.tutorEmail,
          subject: session.metadata.subject,
          studentEmail: session.customer_email,
          price: session.amount_total / 100,
          currency: session.currency,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
        });
      }

      res.send({ success: true });
    });

    //  student payment info  history
    app.get('/payments/student/:email', async (req, res) => {
      const email = req.params.email;
      const result = await paymentHistoryCollection.find({ studentEmail: email }).toArray();
      res.send(result);
    });

    // tuitor paymet   hisory 
    app.get('/payments/tutor/:email', async (req, res) => {
      const email = req.params.email;

      const payments = await paymentHistoryCollection
        .find({ tutorEmail: email })
        .toArray();

      const total = payments.reduce((sum, p) => sum + (p.price || 0), 0);

      res.send({
        totalEarnings: total,
        count: payments.length,
        payments
      });
    });




    //  teacher // tuitor db 
    // Get all applications for a specific tutor
    app.get('/applications/tutor/:email', async (req, res) => {
      const { email } = req.params;

      const result = await applicationsCollection
        .find({ tutorEmail: email })
        .toArray();

      res.send(result);
    });



    // save or update user in db   

    app.post('/user', async (req, res) => {
      const userData = req.body
      userData.created_at = new Date().toISOString()
      userData.last_loggedIn = new Date().toISOString()
      userData.role = 'student'

      const query = {
        email: userData.email,
      }

      const alreadyExists = await usercollection.findOne(query)
      console.log('User Already Exists---> ', !!alreadyExists)

      if (alreadyExists) {
        console.log('Updating user info......')
        const result = await usercollection.updateOne(query, {
          $set: {
            last_loggedIn: new Date().toISOString(),
          },
        })
        return res.send(result)
      }

      console.log('Saving new user info......')
      const result = await usercollection.insertOne(userData)
      res.send(result)
    })

    //  get a user role 
    app.get('/user/role/:email', async (req, res) => {
      const email = req.params.email
      const result = await usercollection.findOne({ email })

      res.send({ role: result?.role })
    })

    // adimin
    // approve student tuition post 
    app.patch("/tuitions/approve/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { status: "approved" } };
      const result = await tuitionscollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // admin reject tuition post 
    app.patch("/tuitions/reject/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { status: "rejected" } };
      const result = await tuitionscollection.updateOne(filter, updateDoc);
      res.send(result);
    });




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('eTuitior server Runn')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
