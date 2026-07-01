export default async function handler(req: any, res: any) {
  try {
    const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `/api/paypal/create-subscription${query}`;
    const { createApp } = await import('../../server');
    const app = await createApp();
    return app(req, res);
  } catch (error: any) {
    console.error('[Vercel API] create-subscription failed:', error);
    return res.status(500).json({
      error: 'Vercel function failed before handling create-subscription',
      message: error?.message || String(error),
    });
  }
}
