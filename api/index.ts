import express from "express";
import {Express, Request, Response} from "express";
import { rateLimit } from 'express-rate-limit'
import dotenv from "dotenv";
import axios from "axios";
import cors from "cors";
import Parser from "rss-parser";
import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";
import { ExternalAccountClient } from 'google-auth-library'; 
import { getVercelOidcToken } from '@vercel/functions/oidc';
import { getReading } from "../service/voice-readings-functions";

let parser = new Parser();

dotenv.config();

const app: Express = express();

let CLIENT_URL: string;

if (process.env.RUN_ENV && process.env.RUN_ENV === "production")
  CLIENT_URL = "https://daily-readings-self.vercel.app";
else
  CLIENT_URL = "*";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCP_PROJECT_NUMBER = process.env.GCP_PROJECT_NUMBER;
const GCP_SERVICE_ACCOUNT_EMAIL = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
const GCP_WORKLOAD_IDENTITY_POOL_ID = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
const GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID =
  process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
  
// Initialize the External Account Client
const authClient = ExternalAccountClient.fromJSON({
  type: 'external_account',
  audience: `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`,
  subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
  token_url: 'https://sts.googleapis.com/v1/token',
  service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
  subject_token_supplier: {
    // Use the Vercel OIDC token as the subject token
    getSubjectToken: getVercelOidcToken,
  },
});


const client = new TextToSpeechClient({
  project: GCP_PROJECT_ID,
  location: 'us-central1',
  googleAuthOptions: {
    authClient,
    projectId: GCP_PROJECT_ID,
  },
});


const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 50, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
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
  const date = req.query.date;
  const items = (await parser.parseURL("https://catholic-daily-reflections.com/feed")).items;

  const filteredItems = items.filter((elem) => elem.contentSnippet && elem.contentSnippet.includes(`${date},`));
  let content;
  let link;
  let audio;
  if (filteredItems.length > 0) {
      const lines = filteredItems[0]["content:encoded"].split("\n");
      let start;
      let end;
      for (const [i, line] of lines.entries()) {
          if (!start && line.includes("https://widget.spreaker.com/player"))
              start = i+1;
          else if (start && !end && i != start && line.includes("<p style=\"text-align: center;\">"))
              end = i;
      }
      content = lines.slice(start, end).join("\n");
      audio = lines[start-1];
      link = filteredItems[0].link;
  }

  res.set("Access-Control-Allow-Origin", CLIENT_URL);
  res.send({content: content, audio: audio, link: link});
})

app.post("/reverse-geocode", async (req: Request, res: Response) => {
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;
  const {data} = await axios.get(`https://us1.locationiq.com/v1/reverse?key=${process.env.LOCATIONIQ_KEY}&lat=${latitude}&lon=${longitude}&format=json&`);
  res.set("Access-Control-Allow-Origin", CLIENT_URL);
  res.send({ //Limit API output to remove incentive for abuse.
    country: data.address.country,
    state: data.address.state
  });
});

app.get("/voice-universalis", async (req: Request, res: Response) => {
  if (req.query && typeof req.query.date === "string" && typeof req.query.regionCode === "string" && typeof req.query.readingCode === "string" ) {
    const text = await getReading(req.query.date, req.query.regionCode, req.query.readingCode);
    if (text.length < 5000) {
      const request : protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: {text: text},
        voice: {languageCode: 'en-GB', ssmlGender: 'MALE'},
        audioConfig: {audioEncoding: 'MP3'},
      };
      const [response] = await client.synthesizeSpeech(request);
      res.set('content-type', 'audio/mp3');
      res.send(response.audioContent);
    } else {
      res.status(400);
      res.send();
    }

  }
});

export default app;