const express = require("express");
const mongodb = require("mongodb").MongoClient;
const { trace, context } = require("@opentelemetry/api");
require("dotenv").config(); // Secure sensitive data using environment variables
require("./tracing"); // OpenTelemetry setup

const app = express();
app.use(express.json());

const tracer = trace.getTracer("todo-api");

// Environment variables for configurations
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/";
const dbName = process.env.DB_NAME || "todo_db";

async function startServer() {
    const client = new mongodb(mongoUrl, { useUnifiedTopology: true });
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(dbName);

    // Initialize sample data if collection is empty
    const existingTodos = await db.collection("todos").find().toArray();
    if (existingTodos.length === 0) {
        const sampleTodos = [
            { id: "1", task: "Learn OpenTelemetry", completed: false },
            { id: "2", task: "Build a REST API", completed: true },
        ];
        await db.collection("todos").insertMany(sampleTodos);
        console.log("Sample data inserted");
    }

    app.get("/todo", async (req, res) => {
        const span = tracer.startSpan("Fetch All Todos");
        try {
            const todos = await db.collection("todos").find().toArray();
            res.send(todos);
        } catch (error) {
            res.status(500).send({ error: "Error fetching todos" });
        } finally {
            span.end();
        }
    });

    app.get("/todo/:id", async (req, res) => {
        const span = tracer.startSpan("Fetch Todo by ID");
        try {
            const todo = await db.collection("todos").findOne({ id: req.params.id });
            if (!todo) {
                res.status(404).send({ error: "Todo not found" });
            } else {
                res.send(todo);
            }
        } catch (error) {
            res.status(500).send({ error: "Error fetching todo" });
        } finally {
            span.end();
        }
    });

    app.post("/todo", async (req, res) => {
        const span = tracer.startSpan("Create Todo");
        try {
            const { id, task, completed = false } = req.body;
            if (!id || !task) {
                res.status(400).send({ error: "ID and task are required" });
                return;
            }
            await db.collection("todos").insertOne({ id, task, completed });
            res.status(201).send({ message: "Todo created" });
        } catch (error) {
            res.status(500).send({ error: "Error creating todo" });
        } finally {
            span.end();
        }
    });

    app.delete("/todo/:id", async (req, res) => {
        const span = tracer.startSpan("Delete Todo");
        try {
            const result = await db.collection("todos").deleteOne({ id: req.params.id });
            if (result.deletedCount === 0) {
                res.status(404).send({ error: "Todo not found" });
            } else {
                res.send({ message: "Todo deleted" });
            }
        } catch (error) {
            res.status(500).send({ error: "Error deleting todo" });
        } finally {
            span.end();
        }
    });

    app.listen(3000, () => {
        console.log("Server is running on http://localhost:3000");
    });
}

startServer().catch((error) => {
    console.error("Error starting server:", error);
    process.exit(1);
});
