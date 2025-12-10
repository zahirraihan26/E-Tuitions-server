const express = require('express')
const cors =require('cors')
const app = express()
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port =process.env.PORT || 3000

// middil were 
app.use(express.json())
app.use(cors())


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

    const db =client.db("etuitor_db")
   
    const tuitionscollection = db.collection('tuitions')

    // Tuitions add new post
    app.get('/tuitions',async(req,res)=>{
      const result =await tuitionscollection.find().toArray()
      res.send(result)
    })
    // save student addnew post 
   app.post('/tuitions',async(req,res)=>{
    const tuition =req.body
    const result =await tuitionscollection.insertOne(tuition)
    res.send(result)
   })


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
