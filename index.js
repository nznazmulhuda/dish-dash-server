const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const cookieParser = require("cookie-parser");

/*****************************************************/
/********************* Middleware ********************/
/*****************************************************/

app.use(
    cors({
        origin: ["http://localhost:3000"],
        credentials: true,
    })
);
app.use(cookieParser());
app.use(express.json());

/*****************************************************/
/***************** Custom Middelware *****************/
/*****************************************************/
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
    }

    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorized access" });
        }
        req.user = decoded;
        next();
    });
};

/*****************************************************/
/*********************** Server **********************/
/*****************************************************/
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pbmq8lu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();

        /*****************************************************/
        /************************ JWT ************************/
        /*****************************************************/
        app.post("/token", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_KEY, {
                expiresIn: "1h",
            });

            res.cookie("token", token, {
                httpOnly: true,
                secure: false,
                sameSite: "strict",
            }).send({ success: true });
        });

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
            const id = req.query.id;
            const totalPage = req.query.page;
            const activePage = req.query.activePage;

            if (id) {
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
                    .skip((activePage - 1) * 9)
                    .limit(9)
                    .toArray();
                return res.send(cursor);
            } else {
                // get all food data
                const cursor = await foodDB.find().toArray();
                return res.send(cursor);
            }
        });

        app.get("/myFood/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const verifyEmail = req?.user?.email;
            if (email) {
                if (verifyEmail !== email) {
                    return res
                        .status(403)
                        .send({ message: "forbidden access" });
                }
                // filter data using email
                const cursor = await foodDB.find({ email: email }).toArray();
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
        /************************ Search *********************/
        /*****************************************************/
        app.get("/search", async (req, res) => {
            const search = req.query.search;
            if (search === "all") {
                const result = await foodDB.find().limit(9).toArray();
                return res.send(result);
            } else {
                const agg = [
                    {
                        $search: {
                            index: "search",
                            text: {
                                query: search,
                                path: {
                                    wildcard: "*",
                                },
                                fuzzy: {},
                            },
                        },
                    },
                ];
                const cursor = foodDB.aggregate(agg);
                const result = await cursor.toArray();
                return res.send(result);
            }
        });

        /*****************************************************/
        /********************** Purchase *********************/
        /*****************************************************/
        app.get("/purchase-food/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const verifyEmail = req?.user?.email;
            if (verifyEmail !== email) {
                return res.status(403).send({ message: "forbidden access" });
            }
            const result = await purchaseDB
                .find({ email: { $eq: email } })
                .toArray();
            res.send(result);
        });

        app.post("/purchase-food", async (req, res) => {
            const food = req.body;
            const id = req.query.id;
            const { quantity } = food;
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
        /********************** Filtering ********************/
        /*****************************************************/
        app.get("/filter", async (req, res) => {
            const price = req.query.price;
            const category = req.query.category;
            console.log({ price, category });
            if (
                (price === "default" && category === "default") ||
                (price === "null" && category === "null")
            ) {
                const result = await foodDB.find().toArray();
                return res.send(result);
            } else if (
                price === "highToLow" &&
                (category === "default" || category === "null")
            ) {
                const result = await foodDB
                    .find()
                    .sort({ foodPrice: -1 })
                    .toArray();
                return res.send(result);
            } else if (
                price === "lowToHigh" &&
                (category === "default" || category === "null")
            ) {
                const result = await foodDB
                    .find()
                    .sort({ foodPrice: +1 })
                    .toArray();
                return res.send(result);
            } else if (
                (price === "highToLow" || price === "null") &&
                category !== "default" &&
                category !== "null"
            ) {
                const filterFood = await foodDB
                    .find()
                    .sort({ foodPrice: -1 })
                    .toArray();
                const result = filterFood.filter(
                    (food) => food.foodCategory === category
                );
                return res.send(result);
            } else if (
                (price === "lowToHigh" || price === "null") &&
                category !== "default" &&
                category !== "null"
            ) {
                const filterFood = await foodDB
                    .find()
                    .sort({ foodPrice: +1 })
                    .toArray();
                const result = filterFood.filter(
                    (food) => food.foodCategory === category
                );
                return res.send(result);
            } else {
                const result = await foodDB.find().toArray();
                return res.send(result);
            }
        });

        /*****************************************************/
        /********************** Category ********************/
        /*****************************************************/
        app.get("/category", async (req, res) => {
            let result = [];
            const allData = await foodDB.find().toArray();
            allData.filter((data) => {
                if (!result.includes(data.foodCategory)) {
                    result.push(data.foodCategory);
                }
            });
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

        app.get("/logout", (req, res) => {
            res.clearCookie("token", { maxAge: 0 }).send({ success: true });
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
