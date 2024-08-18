import express from "express";
import {Express, Request, Response} from "express";
import { rateLimit } from 'express-rate-limit'
import dotenv from "dotenv";
import axios from "axios";
import cors from "cors";
import Parser from "rss-parser";
//import * as PlayHT from "playht";
import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech"; 

const projectId = "read-daily-readings"

let parser = new Parser();

dotenv.config();

const app: Express = express();

let CLIENT_URL: string;

if (process.env.RUN_ENV && process.env.RUN_ENV === "production")
  CLIENT_URL = "https://daily-readings-self.vercel.app";
else
  CLIENT_URL = "*";

const client = new TextToSpeechClient({projectId});


const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
})

// Apply the rate limiting middleware to all requests.
app.use(limiter)

app.use(express.json());

app.use(cors(), function(req: Request, res: Response, next) {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.get("/", (req: Request, res: Response) => {
  res.send("Working");
});

app.get("/feed", async (req: Request, res: Response) => {
  const items = (await parser.parseURL("https://catholic-daily-reflections.com/feed")).items;
  res.set("Access-Control-Allow-Origin", CLIENT_URL);
  res.send(items);
})

app.post("/reverse-geocode", async (req: Request, res: Response) => {
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;
  const {data} = await axios.get(`https://us1.locationiq.com/v1/reverse?key=${process.env.LOCATIONIQ_KEY}&lat=${latitude}&lon=${longitude}&format=json&`);
  res.set("Access-Control-Allow-Origin", CLIENT_URL);
  res.send(data);
});

app.get("/voice", async (req: Request, res: Response) => {
  if (req.query && typeof req.query.text === "string") {
    const text = decodeURI(req.query.text);
    const request : protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: {text: text},
      voice: {languageCode: 'en-GB', ssmlGender: 'MALE'},
      audioConfig: {audioEncoding: 'MP3'},
    };
    try {
      const [response] = await client.synthesizeSpeech(request);
      res.set('content-type', 'audio/mp3');
      res.send(response.audioContent);
    } catch (e) {
      console.log("Error:",e)
    }
  }
});

export default app;