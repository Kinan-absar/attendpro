import { createApp } from '../../server.js';

let cachedApp: any = null;

async function getApp() {
  if (!cachedApp) {
    cachedApp = await createApp({ includeFrontend: false });
  }
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    // Forward query parameters if they exist
    const query = req.url?.split('?')[1];
    req.url = '/api/paypal/create-subscription' + (query ? `?${query}` : '');
    return app(req, res);
  } catch (err: any) {
    console.error("[Vercel Handler Error] Failed inside create-subscription serverless wrapper:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message || String(err) });
  }
}
