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
    const query = req.url?.split('?')[1];
    req.url = '/api/paypal/cancel-subscription' + (query ? `?${query}` : '');
    return app(req, res);
  } catch (err: any) {
    console.error("[Vercel Handler Error] Failed inside cancel-subscription serverless wrapper:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message || String(err) });
  }
}
