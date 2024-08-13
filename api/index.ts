import express from "express";
import {Express, Request, Response} from "express";
import dotenv from "dotenv";
import axios from "axios";
import cors from "cors";

dotenv.config();

const app: Express = express();

let CLIENT_URL;

if (process.env.RUN_ENV && process.env.RUN_ENV === "production")
  CLIENT_URL = "https://daily-readings-self.vercel.app"
else
  CLIENT_URL = "http://localhost:3000"

app.use(express.json());

app.use(cors(), function(req, res, next) {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.get("/", (req: Request, res: Response) => {
  res.send("Working")
});

app.post("/reverse-geocode", async (req: Request, res: Response) => {
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;
  const {data} = await axios.get(`https://us1.locationiq.com/v1/reverse?key=${process.env.LOCATIONIQ_KEY}&lat=${latitude}&lon=${longitude}&format=json&`);
  res.set("Access-Control-Allow-Origin", CLIENT_URL);
  res.send(data);
});

export default app;