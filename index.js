const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9crls8f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        const scholarshipCollection = client.db("scholarshipPortalDB").collection("scholarships");
        const userCollection = client.db("scholarshipPortalDB").collection("users");
        const reviewCollection = client.db("scholarshipPortalDB").collection("reviews");
        const appliedScholarshipCollection = client.db("scholarshipPortalDB").collection("appliedScholarships");

        // Fetch scholarships
        app.get("/top-scholarships", async (req, res) => {
            // Sort scholarships by application fees (lowest first) and then by post date (newest first)
            const scholarships = await scholarshipCollection.find()
                .sort({ application_fees: 1, post_date: -1 })
                .toArray();

            res.send(scholarships);
        });

        // Fetch scholarships by id
        app.get("/top-scholarships/:id", async (req, res) => {
            const result = await scholarshipCollection.findOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

        // Update scholarship
        app.put("/update-scholarships/:id", async (req, res) => {
            const query = { _id: new ObjectId(req.params.id) };
            const options = { upsert: true };

            const data = {
                $set: {
                    university_name: req.body.university_name,
                    scholarship_category: req.body.scholarship_category,
                    university_logo: req.body.university_logo,
                    application_deadline: req.body.application_deadline,
                    subject_name: req.body.subject_name,
                    scholarship_description: req.body.scholarship_description,
                    stipend: req.body.stipend,
                    post_date: req.body.post_date,
                    service_charge: req.body.service_charge,
                    application_fees: req.body.application_fees,
                    degree_name: req.body.degree_name,
                    'university_location.country': req.body.country,
                }
            };

            const result = await scholarshipCollection.updateOne(query, data, options);
            res.send(result);
        });

        // Cancel scholarship
        app.delete("/top-scholarships/:id", async (req, res) => {
            const id = req.params.id;
            const result = await scholarshipCollection.deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount === 1) {
                res.send(result);
            }
        });

        // Fetch reviews
        app.get("/reviews", async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        });

        //  Post user
        app.post("/users", async (req, res) => {
            const user = req.body;

            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User already exists", insertedId: null })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        // Fetch users
        app.get("/users", async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // Update user role
        app.patch("/users/:id/role", async (req, res) => {
            const id = req.params.id;
            const role = req.body.role;

            const updatedUser = await userCollection.findOneAndUpdate(
                { _id: new ObjectId(id) },
                { $set: { role: role } },
                { returnDocument: 'after' }
            );

            res.send(updatedUser.value);
        });

        // Delete user
        app.delete("/users/:id", async (req, res) => {
            const id = req.params.id;
            const result = await userCollection.deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount === 1) {
                res.send(result);
            }
        });

        // Fetch user role by email
        app.get("/user-role/:email", async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });

            if (user) {
                res.send({ role: user.role });
            }
            else {
                res.status(404).send({ error: "User not found" });
            }
        });

        // Post scholarship application
        app.post("/applied-scholarships", async (req, res) => {
            const item = req.body;
            const result = await appliedScholarshipCollection.insertOne(item);
            res.send(result);
        });

        // Payment intent
        app.post("/create-payment-intent", async (req, res) => {
            const { fees } = req.body;
            const amount = parseInt(fees * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            });
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Server is running...");
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});