const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

/*****************************************************/
/********************* Middleware ********************/
/*****************************************************/

app.use(cors());
app.use(express.json());

/*****************************************************/
/*********************** Server **********************/
/*****************************************************/

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pbmq8lu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();

        /*****************************************************/
        /******************* DB Collection's *****************/
        /*****************************************************/

        const userDB = client.db("DishDashDB").collection("users");
        const galleryDB = client.db("DishDashDB").collection("gallery");
        const foodDB = client.db("DishDashDB").collection("foods");
        const purchaseDB = client.db("DishDashDB").collection("purchase");

        /*****************************************************/
        /************************ Users **********************/
        /*****************************************************/

        app.get("/users", async (req, res) => {
            const cursor = await userDB.find().toArray();
            res.send(cursor);
        });

        app.post("/users", async (req, res) => {
            const user = req.body;
            const result = await userDB.insertOne(user);
            res.send(result);
        });

        /*****************************************************/
        /********************** Gallery **********************/
        /*****************************************************/

        app.get("/gallery", async (req, res) => {
            const cursor = await galleryDB.find().toArray();
            res.send(cursor);
        });

        app.post("/gallery", async (req, res) => {
            const data = req.body;
            const result = await galleryDB.insertOne(data);
            res.send(result);
        });

        /*****************************************************/
        /************************ Food ***********************/
        /*****************************************************/

        app.get("/foods", async (req, res) => {
            const email = req.query.email;
            const search = req.query.search;
            const id = req.query.id;
            const totalPage = req.query.page;
            const activePage = req.query.activePage;
            const pageNo = req.query.pageNo;

            if (email) {
                // filter data using email
                const cursor = await foodDB.find({ email: email }).toArray();
                return res.send(cursor);
            } else if (search) {
                // search function
                const query = search.charAt().toUpperCase() + search.slice(1);
                const cursor = await foodDB
                    .find({
                        $or: [
                            { foodCategory: { $eq: query } },
                            { foodName: { $eq: query } },
                        ],
                    })
                    .toArray();
                return res.send(cursor);
            } else if (id) {
                // filter data using id
                const cursor = await foodDB
                    .find({ _id: new ObjectId(id) })
                    .toArray();
                res.send(cursor);
            } else if (totalPage) {
                // get total data length
                const cursor = await foodDB.find().toArray();
                const pages = cursor.length;
                return res.send({ pages });
            } else if (activePage) {
                // Pagination
                const cursor = await foodDB
                    .find()
                    .skip((pageNo - 1) * 9)
                    .limit(9)
                    .toArray();
                return res.send(cursor);
            } else {
                // get all food data
                const cursor = await foodDB.find().toArray();
                return res.send(cursor);
            }
        });

        app.post("/foods", async (req, res) => {
            const food = req.body;
            food.purchase = 0;
            const result = await foodDB.insertOne(food);
            res.send(result);
        });

        /*****************************************************/
        /********************** Purchase *********************/
        /*****************************************************/

        app.get("/purchase-food", async (req, res) => {
            const email = req.query.email;
            const cursor = await purchaseDB.find({ email: email }).toArray();
            res.send(cursor);
        });

        app.post("/purchase-food", async (req, res) => {
            const food = req.body;
            const id = req.query.id;
            const { quantity } = food;
            console.log(quantity);
            foodDB.updateOne(
                { _id: new ObjectId(id) },
                {
                    $inc: {
                        foodQuantity: -quantity,
                        purchase: +quantity,
                    },
                }
            );
            const result = await purchaseDB.insertOne(food);
            res.send(result);
        });

        /*****************************************************/
        /********************** Top Food *********************/
        /*****************************************************/

        app.get("/top-food", async (req, res) => {
            const result = await foodDB
                .find()
                .sort({ purchase: -1 })
                .limit(6)
                .toArray();
            res.send(result);
        });

        /*****************************************************/
        /*********************** Update **********************/
        /*****************************************************/

        app.put("/update", async (req, res) => {
            const id = req.query.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateFood = req.body;
            const food = {
                $set: {
                    url: updateFood.url,
                    foodName: updateFood.foodName,
                    foodCategory: updateFood.foodCategory,
                    foodPrice: updateFood.foodPrice,
                    foodQuantity: updateFood.foodQuantity,
                    about: updateFood.about,
                },
            };
            const result = await foodDB.updateOne(filter, food, options);
            res.send(result);
        });

        /*****************************************************/
        /*********************** Delete **********************/
        /*****************************************************/

        app.delete("/delete", async (req, res) => {
            const id = req.query.id;
            const DB = req.query.db;
            if (DB === "purchaseDB") {
                const result = purchaseDB.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } else if (DB === "foodDB") {
                const result = foodDB.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            }
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Server is running...");
});

app.listen(port, () => console.log(`Server is running on port: ${port}`));
