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

        // Add a new scholarship
        app.post("/scholarships", async (req, res) => {
            const scholarshipData = req.body;
            const result = await scholarshipCollection.insertOne(scholarshipData);
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

        // Fetch reviews by user email
        app.get("/reviews/:email", async (req, res) => {
            const email = req.params.email;
            const reviews = await reviewCollection.find({ email: email }).toArray();
            res.send(reviews);
        });

        // Fetch reviews by scholarship ID
        app.get("/reviews/:scholarshipId", async (req, res) => {
            const scholarshipId = req.params.scholarshipId;
            const reviews = await reviewCollection.find({ scholarship_id: scholarshipId }).toArray();

            if (!reviews) {
                return res.status(404).json({ error: "No reviews found for this scholarship ID" });
            }

            res.json(reviews);
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

        // Fetch applied scholarships
        app.get("/applications", async (req, res) => {
            const result = await appliedScholarshipCollection.find().toArray();
            res.send(result);
        });

        // Fetch applications by user email
        app.get("/applications/:email", async (req, res) => {
            const email = req.params.email;
            const scholarships = await appliedScholarshipCollection.find({ userEmail: email }).toArray();
            res.send(scholarships);
        });

        // Delete applied scholarships
        app.delete("/applications/:id", async (req, res) => {
            const id = req.params.id;
            const result = await appliedScholarshipCollection.deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount === 1) {
                res.send(result);
            }
        });

        // Update application status
        app.put("/applications/:applicationId/cancel", async (req, res) => {
            const applicationId = req.params.applicationId;
            const result = await appliedScholarshipCollection.updateOne(
                { _id: new ObjectId(applicationId) },
                { $set: { applicationStatus: "rejected" } }
            );
            res.send(result);
        });

        // Update feedback
        app.post("/applications/:applicationId/feedback", async (req, res) => {
            const { applicationId } = req.params;
            const { feedback } = req.body;

            const result = await appliedScholarshipCollection.updateOne(
                { _id: new ObjectId(applicationId) },
                { $set: { feedback } }
            );
            res.send(result);
        });

        // Fetch applied scholarships by user email
        app.get("/applied-scholarships/:email", async (req, res) => {
            const email = req.params.email;
            const appliedScholarships = await appliedScholarshipCollection.find({ email: email }).toArray();
            res.send(appliedScholarships);
        });

        app.put("/applications/:id", async (req, res) => {
            const appliedScholarshipId = req.params.id;
            const updateData = req.body;

            await connectAndRun(async (database) => {
                const appliedScholarshipCollection = database.collection("appliedScholarships");
                const filter = { _id: new ObjectId(appliedScholarshipId) };
                const updateResult = await appliedScholarshipCollection.updateOne(filter, { $set: updateData });

                if (updateResult.modifiedCount === 1) {
                    res.send("Applied scholarship updated successfully");
                } else {
                    res.status(404).send("Applied scholarship not found");
                }
            });
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