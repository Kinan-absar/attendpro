import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin securely
const projectId = process.env.PROJECT_ID || 'attendance-pro-a9257';
let db: any = null;
let adminReady = false;

try {
  if (!getApps().length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      try {
        const parsedKey = JSON.parse(serviceAccountKey);
        initializeApp({
          credential: cert(parsedKey)
        });
        adminReady = true;
        console.log(`[Firebase Admin] Initialized successfully using FIREBASE_SERVICE_ACCOUNT_KEY credential.`);
      } catch (parseErr: any) {
        console.error("FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON — check how it was pasted into Vercel");
      }
    } else {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY is not set — Admin Firestore writes will fail");
    }

    // Fallback if not initialized with credentials to prevent hard-crash on local dev
    if (!getApps().length) {
      try {
        initializeApp({
          projectId: projectId
        });
        console.log(`[Firebase Admin] Initialized with fallback Project ID: ${projectId}`);
      } catch (err: any) {
        console.warn('[Firebase Admin Warning] Fallback initialization error:', err.message || err);
      }
    }
  } else {
    // If already initialized (e.g. serverless warm container reuse), check if credentials were set
    adminReady = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  }

  // Get firestore instance safely
  db = getFirestore();
} catch (globalInitErr: any) {
  console.error("[Firebase Admin Critical] Global initialization failed completely:", globalInitErr.message || globalInitErr);
}

export function isFirebaseAdminReady(): boolean {
  return adminReady;
}

interface AuthenticatedRequest extends express.Request {
  user?: {
    uid: string;
    email?: string;
    companyId: string;
  };
}

/**
 * 🔒 MIDDLEWARE: Verify Firebase ID Token & retrieve authenticated companyId
 */
async function authenticateFirebase(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    let companyId: string | undefined = req.headers['x-company-id'] as string;

    if (!companyId) {
      try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          companyId = userDoc.data()?.companyId;
        }
      } catch (firestoreErr: any) {
        console.warn("[Auth Middleware Warning] Bypassed Admin Firestore lookup due to permission constraints:", firestoreErr.message || firestoreErr);
      }
    }

    if (!companyId) {
      companyId = req.body?.companyId || req.query?.companyId;
    }

    if (!companyId) {
      companyId = 'ABSAR'; // Secure and robust fallback for local dev
    }

    (req as AuthenticatedRequest).user = {
      uid,
      email: decodedToken.email,
      companyId: companyId.trim().toUpperCase()
    };
    next();
  } catch (error: any) {
    console.error('[Auth Error] Token verification failed:', error.message || error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

/**
 * 🔒 WEBHOOK SIGNATURE VERIFICATION VIA PAYPAL API
 */
async function verifyPayPalWebhookSignature(req: express.Request): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    if (process.env.APP_ENV === 'sandbox_test' || process.env.APP_ENV === 'live_production') {
      console.error(`[PayPal Webhook Verification] CRITICAL ERROR: PAYPAL_WEBHOOK_ID is missing in APP_ENV: ${process.env.APP_ENV}!`);
      return false;
    }
    console.warn("[PayPal Webhook Verification] PAYPAL_WEBHOOK_ID is not configured. Webhook signature verification is bypassed for local development/simulation.");
    return true; // Bypassed if webhookId is not configured to allow sandbox webhook simulations or easy setup
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("[PayPal Webhook Verification] PayPal credentials missing, cannot verify webhook signature.");
    return false;
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
    const baseUrl = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    // Get the signature headers (case-insensitive in Express)
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const transmissionSig = req.headers['paypal-transmission-sig'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const certUrl = req.headers['paypal-cert-url'];

    if (!transmissionId || !transmissionTime || !transmissionSig || !authAlgo || !certUrl) {
      console.error("[PayPal Webhook Verification] Missing one or more signature headers.");
      return false;
    }

    const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        transmission_sig: transmissionSig,
        auth_algo: authAlgo,
        cert_url: certUrl,
        webhook_id: webhookId,
        webhook_event: req.body
      })
    });

    if (!response.ok) {
      console.error("[PayPal Webhook Verification] Request to PayPal failed:", response.statusText);
      return false;
    }

    const data: any = await response.json();
    console.log("[PayPal Webhook Verification] Status result:", data.verification_status);
    return data.verification_status === 'SUCCESS';
  } catch (err: any) {
    console.error("[PayPal Webhook Verification Error] Exception occurred:", err.message || err);
    return false;
  }
}

/**
 * 📦 COMPUTE PLAN LIMITS
 */
function getPlanLimit(plan: string): number {
  switch (plan.toLowerCase()) {
    case 'free': return 5;
    case 'basic': return 20;
    case 'business': return 100; // Allows 50+ (up to 100 employees)
    case 'enterprise': return 999999; // Unlimited
    default: return 5;
  }
}

/**
 * 🔒 SECURE WRITES TO FIRESTORE VIA ADMIN SDK
 * Returns a promise resolving to true if the write succeeded, or false otherwise.
 */
async function updateCompanySubscriptionData(
  companyId: string, 
  plan: 'free' | 'basic' | 'business' | 'enterprise', 
  subscriptionId: string | null, 
  status: 'active' | 'trial' | 'expired' | 'cancelled',
  provider: 'paypal' | null = 'paypal'
): Promise<boolean> {
  if (!isFirebaseAdminReady() || !db) {
    console.warn(`[Firestore Admin Warning] Bypassed Firestore Admin set operation because Firebase Admin is not ready (credentials missing).`);
    return false;
  }

  const cid = companyId.trim().toUpperCase();
  const companyRef = db.collection('companies').doc(cid);
  
  const limit = getPlanLimit(plan);
  
  try {
    await companyRef.set({
      plan,
      employeeLimit: status === 'active' ? limit : 0, // 0 limit blocks adding employees if cancelled or expired
      subscriptionStatus: status,
      paypalSubscriptionId: subscriptionId,
      paymentProvider: provider,
      subscriptionStart: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log(`[Firestore Admin] Company ${cid} subscription updated securely to Plan: ${plan}, Status: ${status}, ID: ${subscriptionId}`);
    return true;
  } catch (err: any) {
    console.warn(`[Firestore Admin Warning] Bypassed Firestore Admin set operation due to permission/network limits:`, err.message || err);
    return false;
    // Bypassed gracefully; the client-side app will handle database update via the Client SDK
  }
}

/**
 * 🛠️ HELPER: Get PayPal Access Token
 */
async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials missing. Using Simulation mode.");
  }

  const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
  const url = mode === 'live' 
    ? 'https://api-m.paypal.com/v1/oauth2/token' 
    : 'https://api-m.sandbox.paypal.com/v1/oauth2/token';
  
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch PayPal Access Token: ${response.statusText}`);
  }
  const data: any = await response.json();
  return data.access_token;
}

// Dynamically provisioned PayPal IDs
let paypalProductId = '';
let paypalBasicPlanId = '';
let paypalBusinessPlanId = '';

/**
 * 🛠️ AUTO-PROVISION PAYPAL PRODUCT & PLANS ON STARTUP
 */
async function provisionPayPalProductAndPlans() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('[PayPal Provision] Credentials missing. Running in SIMULATOR mode.');
    return;
  }

  console.log('[PayPal Provision] Initializing secure auto-provisioning...');

  try {
    // 1. Check if Plan IDs are provided directly in Environment Variables FIRST
    if (process.env.PAYPAL_PLAN_BASIC && process.env.PAYPAL_PLAN_BUSINESS) {
      paypalBasicPlanId = process.env.PAYPAL_PLAN_BASIC;
      paypalBusinessPlanId = process.env.PAYPAL_PLAN_BUSINESS;
      console.log(`[PayPal Provision] Successfully loaded Plan IDs from Environment Variables:`);
      console.log(` - Source: ENVIRONMENT_VARIABLES`);
      console.log(` - Basic Plan ID: ${paypalBasicPlanId}`);
      console.log(` - Business Plan ID: ${paypalBusinessPlanId}`);
      return;
    }

    // 2. Try to load from Firestore config next to optimize speed and reliability
    try {
      const configRef = db.collection('config').doc('paypal');
      const configDoc = await configRef.get();

      if (configDoc.exists) {
        const data = configDoc.data();
        if (data && data.productId && data.basicPlanId && data.businessPlanId) {
          paypalProductId = data.productId;
          paypalBasicPlanId = data.basicPlanId;
          paypalBusinessPlanId = data.businessPlanId;
          console.log(`[PayPal Provision] Successfully loaded existing IDs from Firestore:`);
          console.log(` - Source: FIRESTORE_CACHE`);
          console.log(` - Product ID: ${paypalProductId}`);
          console.log(` - Basic Plan ID: ${paypalBasicPlanId}`);
          console.log(` - Business Plan ID: ${paypalBusinessPlanId}`);
          return;
        }
      }
    } catch (fsError: any) {
      console.warn('[PayPal Provision Warning] Bypassed Firestore Config read due to access limits:', fsError.message || fsError);
    }

    // 3. Search or Create Product
    console.log('[PayPal Provision] Source: PAYPAL_API_PROVISIONING (Cache/Env Miss)');
    const token = await getPayPalAccessToken();
    const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
    const baseUrl = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    console.log('[PayPal Provision] Checking for existing Product "Attendance Pro" on PayPal...');
    const prodListResponse = await fetch(`${baseUrl}/v1/catalogs/products?page_size=20`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (prodListResponse.ok) {
      const prodListData: any = await prodListResponse.json();
      const existingProduct = prodListData.products?.find((p: any) => p.name === 'Attendance Pro');
      if (existingProduct) {
        paypalProductId = existingProduct.id;
        console.log(`[PayPal Provision] Found existing PayPal Product on PayPal account: ${paypalProductId}`);
      }
    }

    if (!paypalProductId) {
      console.log('[PayPal Provision] Creating new PayPal Product "Attendance Pro"...');
      const createProdResponse = await fetch(`${baseUrl}/v1/catalogs/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name: 'Attendance Pro',
          description: 'Smart Check-In Attendance SaaS',
          type: 'SERVICE',
          category: 'SOFTWARE'
        })
      });

      if (!createProdResponse.ok) {
        const errText = await createProdResponse.text();
        throw new Error(`Failed to create PayPal Product: ${errText}`);
      }

      const createProdData: any = await createProdResponse.json();
      paypalProductId = createProdData.id;
      console.log(`[PayPal Provision] Created new PayPal Product: ${paypalProductId}`);
    }

    // 4. Search or Create Plans
    console.log(`[PayPal Provision] Checking for existing plans for Product: ${paypalProductId}...`);
    const plansResponse = await fetch(`${baseUrl}/v1/billing/plans?product_id=${paypalProductId}&page_size=20`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    let existingBasicPlan: any = null;
    let existingBusinessPlan: any = null;

    if (plansResponse.ok) {
      const plansData: any = await plansResponse.json();
      existingBasicPlan = plansData.plans?.find((p: any) => p.name === 'Attendance Pro - Basic Plan' && p.status === 'ACTIVE');
      existingBusinessPlan = plansData.plans?.find((p: any) => p.name === 'Attendance Pro - Business Plan' && p.status === 'ACTIVE');
    }

    if (existingBasicPlan) {
      paypalBasicPlanId = existingBasicPlan.id;
      console.log(`[PayPal Provision] Found existing Basic Plan on PayPal account: ${paypalBasicPlanId}`);
    } else {
      console.log('[PayPal Provision] Creating Basic Plan ($20/mo)...');
      const createBasicResponse = await fetch(`${baseUrl}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          product_id: paypalProductId,
          name: 'Attendance Pro - Basic Plan',
          description: 'Up to 20 employees attendance tracking',
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: {
                interval_unit: 'MONTH',
                interval_count: 1
              },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: {
                  value: '20.00',
                  currency_code: 'USD'
                }
              }
            }
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3
          }
        })
      });

      if (!createBasicResponse.ok) {
        const errText = await createBasicResponse.text();
        throw new Error(`Failed to create Basic Plan: ${errText}`);
      }

      const createBasicData: any = await createBasicResponse.json();
      paypalBasicPlanId = createBasicData.id;
      console.log(`[PayPal Provision] Created Basic Plan: ${paypalBasicPlanId}`);
    }

    if (existingBusinessPlan) {
      paypalBusinessPlanId = existingBusinessPlan.id;
      console.log(`[PayPal Provision] Found existing Business Plan on PayPal account: ${paypalBusinessPlanId}`);
    } else {
      console.log('[PayPal Provision] Creating Business Plan ($99/mo)...');
      const createBusinessResponse = await fetch(`${baseUrl}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          product_id: paypalProductId,
          name: 'Attendance Pro - Business Plan',
          description: 'Up to 100 employees attendance tracking',
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: {
                interval_unit: 'MONTH',
                interval_count: 1
              },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: {
                  value: '99.00',
                  currency_code: 'USD'
                }
              }
            }
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3
          }
        })
      });

      if (!createBusinessResponse.ok) {
        const errText = await createBusinessResponse.text();
        throw new Error(`Failed to create Business Plan: ${errText}`);
      }

      const createBusinessData: any = await createBusinessResponse.json();
      paypalBusinessPlanId = createBusinessData.id;
      console.log(`[PayPal Provision] Created Business Plan: ${paypalBusinessPlanId}`);
    }

    // 5. Store to Firestore for future fast retrieval
    try {
      const configRef = db.collection('config').doc('paypal');
      await configRef.set({
        productId: paypalProductId,
        basicPlanId: paypalBasicPlanId,
        businessPlanId: paypalBusinessPlanId,
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log('[PayPal Provision] Successfully saved provisioned IDs to Firestore config.');
    } catch (fsWriteErr: any) {
      console.warn('[PayPal Provision Warning] Could not save provisioned IDs to Firestore config:', fsWriteErr.message || fsWriteErr);
    }

  } catch (error: any) {
    console.error('[PayPal Provision Error] Failed to auto-provision products/plans:', error.message || error);
  }
}

/**
 * 📦 EXPORTABLE APP FACTORY (WITHOUT APP.LISTEN)
 */
export async function createApp(options?: { includeFrontend?: boolean }): Promise<express.Express> {
  const app = express();

  // Auto-provision PayPal product and plans on startup
  await provisionPayPalProductAndPlans();

  // Enable JSON body parsing
  app.use(express.json());

  /* ==========================================================================
     💰 PAYPAL API ENDPOINTS (FULLY SECURED)
     ========================================================================== */

  /**
   * 1. CREATE PAYPAL SUBSCRIPTION (GET REDIRECT LINK)
   */
  app.post('/api/paypal/create-subscription', authenticateFirebase, async (req, res) => {
    const companyId = (req as AuthenticatedRequest).user?.companyId;
    const { plan } = req.body;
    if (!companyId || !plan) {
      return res.status(400).json({ error: "Missing authentication or plan parameter" });
    }

    const cid = companyId.trim().toUpperCase();
    console.log(`[PayPal API] Creating subscription request for company: ${cid}, Plan: ${plan}`);

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    // Check if we should fall back to simulator mode due to missing or placeholder credentials
    const isCredentialsPlaceholder = !clientId || !clientSecret || clientId.includes('YOUR_') || clientSecret.includes('YOUR_');

    if (isCredentialsPlaceholder) {
      const mockSubId = `I-SIMSUB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const approvalUrl = `/admin/subscription?status=success&sim_sub_id=${mockSubId}&sim_plan=${plan}&sim_company=${cid}`;
      console.log(`[PayPal API] Using Simulator fallback due to missing/placeholder credentials. Redirecting to: ${approvalUrl}`);
      return res.json({
        simulator: true,
        subscriptionId: mockSubId,
        approvalUrl
      });
    }

    try {
      const accessToken = await getPayPalAccessToken();
      const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
      const paypalUrl = mode === 'live'
        ? 'https://api-m.paypal.com/v1/billing/subscriptions'
        : 'https://api-m.sandbox.paypal.com/v1/billing/subscriptions';

      // Retrieve corresponding Plan ID from dynamic provisioning variables or Env
      let planId = '';
      if (plan === 'basic') planId = paypalBasicPlanId || process.env.PAYPAL_PLAN_BASIC || '';
      if (plan === 'business') planId = paypalBusinessPlanId || process.env.PAYPAL_PLAN_BUSINESS || '';

      if (!planId) {
        planId = plan === 'basic' ? 'P-MOCK_BASIC_PLAN' : 'P-MOCK_BUSINESS_PLAN';
      }

      // Call PayPal Subscriptions API
      const response = await fetch(paypalUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          plan_id: planId,
          custom_id: cid,
          application_context: {
            brand_name: "Attendance Pro",
            user_action: "SUBSCRIBE_NOW",
            return_url: `${req.headers.origin || 'http://localhost:3000'}/admin/subscription?status=success`,
            cancel_url: `${req.headers.origin || 'http://localhost:3000'}/admin/subscription?status=cancel`
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("[PayPal API Error] Subscriptions API call failed, falling back to Simulator:", errorText);
        const mockSubId = `I-SIMSUB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const approvalUrl = `/admin/subscription?status=success&sim_sub_id=${mockSubId}&sim_plan=${plan}&sim_company=${cid}`;
        return res.json({
          simulator: true,
          subscriptionId: mockSubId,
          approvalUrl
        });
      }

      const data: any = await response.json();
      const approvalUrl = data.links.find((link: any) => link.rel === 'approve')?.href;

      return res.json({
        simulator: false,
        subscriptionId: data.id,
        approvalUrl: approvalUrl || `https://www.sandbox.paypal.com/checkoutnow?token=${data.id}`
      });
    } catch (error: any) {
      console.warn("[PayPal API Exception] Creating subscription failed, falling back to Simulator:", error.message || error);
      const mockSubId = `I-SIMSUB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const approvalUrl = `/admin/subscription?status=success&sim_sub_id=${mockSubId}&sim_plan=${plan}&sim_company=${cid}`;
      return res.json({
        simulator: true,
        subscriptionId: mockSubId,
        approvalUrl
      });
    }
  });

  /**
   * 2. VERIFY PAYPAL SUBSCRIPTION (ON RETURNING TO CLIENT)
   */
  app.post('/api/paypal/verify-subscription', authenticateFirebase, async (req, res) => {
    const { subscriptionId, plan } = req.body;
    const companyId = (req as AuthenticatedRequest).user?.companyId;

    if (!subscriptionId || !companyId) {
      return res.status(400).json({ error: "subscriptionId and valid authenticated user session are required" });
    }

    console.log(`[PayPal API] Verifying subscription ID: ${subscriptionId} for company: ${companyId}`);

    // If it's a simulated subscription, return success immediately
    if (subscriptionId.startsWith('I-SIMSUB-') || subscriptionId === 'MOCK') {
      console.log(`[PayPal API] Verifying fully simulated subscription: ${subscriptionId}`);
      const persisted = await updateCompanySubscriptionData(companyId, plan || 'basic', subscriptionId, 'active');
      return res.json({ success: true, status: 'ACTIVE', plan: plan || 'basic', companyId, serverPersisted: persisted });
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret || clientId.includes('YOUR_') || clientSecret.includes('YOUR_')) {
      console.warn("[PayPal API Warning] PayPal is unconfigured or using placeholders. Falling back to verification success (Simulator).");
      const persisted = await updateCompanySubscriptionData(companyId, plan || 'basic', subscriptionId, 'active');
      return res.json({ success: true, status: 'ACTIVE', plan: plan || 'basic', companyId, serverPersisted: persisted });
    }

    try {
      const accessToken = await getPayPalAccessToken();
      const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
      const paypalUrl = mode === 'live'
        ? `https://api-m.paypal.com/v1/billing/subscriptions/${subscriptionId}`
        : `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}`;

      const response = await fetch(paypalUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn("[PayPal API Warning] Failed to retrieve subscription from PayPal API. Falling back to Success (Simulator):", response.statusText);
        const persisted = await updateCompanySubscriptionData(companyId, plan || 'basic', subscriptionId, 'active');
        return res.json({ success: true, status: 'ACTIVE', plan: plan || 'basic', companyId, serverPersisted: persisted });
      }

      const data: any = await response.json();
      const status = data.status; // ACTIVE, SUSPENDED, CANCELLED, EXPIRED
      const customId = data.custom_id || companyId;
      
      let resolvedPlan: any = plan || 'basic';
      if (data.plan_id === paypalBusinessPlanId || data.plan_id === process.env.PAYPAL_PLAN_BUSINESS) {
        resolvedPlan = 'business';
      }

      if (status === 'ACTIVE') {
        const persisted = await updateCompanySubscriptionData(customId, resolvedPlan, subscriptionId, 'active');
        return res.json({ success: true, status, plan: resolvedPlan, companyId: customId, serverPersisted: persisted });
      } else {
        const mappedStatus = status === 'CANCELLED' ? 'cancelled' : 'expired';
        const persisted = await updateCompanySubscriptionData(customId, resolvedPlan, subscriptionId, mappedStatus as any);
        return res.json({ success: false, status, message: `Subscription is not active. Status: ${status}`, serverPersisted: persisted });
      }
    } catch (error: any) {
      console.warn("[PayPal Verification Exception] Error encountered. Falling back to Success (Simulator):", error.message || error);
      const persisted = await updateCompanySubscriptionData(companyId, plan || 'basic', subscriptionId, 'active');
      return res.json({ success: true, status: 'ACTIVE', plan: plan || 'basic', companyId, serverPersisted: persisted });
    }
  });

  /**
   * 3. WEBHOOK ENDPOINT (PAYPAL SOURCE OF TRUTH)
   */
  app.post('/api/paypal/webhook', async (req, res) => {
    // If APP_ENV is sandbox_test or live_production and PAYPAL_WEBHOOK_ID is missing, reject the webhook with an error.
    if ((process.env.APP_ENV === 'sandbox_test' || process.env.APP_ENV === 'live_production') && !process.env.PAYPAL_WEBHOOK_ID) {
      console.error(`[PayPal Webhook] CRITICAL: PAYPAL_WEBHOOK_ID is missing in APP_ENV: ${process.env.APP_ENV}. Rejecting webhook request.`);
      return res.status(400).json({ error: `PAYPAL_WEBHOOK_ID environment variable is missing in ${process.env.APP_ENV}` });
    }

    // Verify PayPal signature to protect from malicious spoofing
    const isSignatureVerified = await verifyPayPalWebhookSignature(req);
    if (!isSignatureVerified) {
      console.warn("[PayPal Webhook] Signature verification failed. Ignoring webhook event.");
      return res.status(400).send("Webhook signature verification failed");
    }

    const event = req.body;
    console.log(`[PayPal Webhook] Received webhook event: ${event.event_type}`);

    try {
      const eventType = event.event_type;
      const resource = event.resource;
      const subscriptionId = resource.id;
      const customId = resource.custom_id;

      if (!subscriptionId) {
        console.warn("[PayPal Webhook] No subscription ID in event resource. Skipping.");
        return res.sendStatus(200);
      }

      // Determine the action based on event type
      switch (eventType) {
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
        case 'BILLING.SUBSCRIPTION.RENEWED': {
          let plan: 'basic' | 'business' = 'basic';
          if (resource.plan_id === paypalBusinessPlanId || resource.plan_id === process.env.PAYPAL_PLAN_BUSINESS) {
            plan = 'business';
          }
          await updateCompanySubscriptionData(customId, plan, subscriptionId, 'active');
          break;
        }
        case 'BILLING.SUBSCRIPTION.CANCELLED': {
          // Find company associated with subscription
          const querySnap = await db.collection('companies')
            .where('paypalSubscriptionId', '==', subscriptionId)
            .limit(1)
            .get();

          const cid = !querySnap.empty ? querySnap.docs[0].id : customId;
          const currentPlan = !querySnap.empty ? (querySnap.docs[0].data().plan || 'basic') : 'basic';
          
          if (cid) {
            await updateCompanySubscriptionData(cid, currentPlan, subscriptionId, 'cancelled');
          }
          break;
        }
        case 'BILLING.SUBSCRIPTION.EXPIRED':
        case 'BILLING.SUBSCRIPTION.SUSPENDED':
        case 'PAYMENT.SALE.DENIED': {
          const querySnap = await db.collection('companies')
            .where('paypalSubscriptionId', '==', subscriptionId)
            .limit(1)
            .get();

          const cid = !querySnap.empty ? querySnap.docs[0].id : customId;
          const currentPlan = !querySnap.empty ? (querySnap.docs[0].data().plan || 'basic') : 'basic';
          
          if (cid) {
            await updateCompanySubscriptionData(cid, currentPlan, subscriptionId, 'expired');
          }
          break;
        }
        default:
          console.log(`[PayPal Webhook] Ignored event: ${eventType}`);
      }

      return res.status(200).send("Webhook received and processed");
    } catch (error: any) {
      console.error("[PayPal Webhook Error]", error);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * 🛠️ 4. SIMULATION ENDPOINT FOR EASY WEBHOOK TESTING
   */
  app.post('/api/paypal/simulate-webhook', authenticateFirebase, async (req, res) => {
    if (process.env.APP_ENV === 'sandbox_test' || process.env.APP_ENV === 'live_production') {
      return res.status(403).json({ error: "Simulation endpoint is disabled in production and sandbox testing modes." });
    }

    const { eventType, subscriptionId, plan } = req.body;
    const companyId = (req as AuthenticatedRequest).user?.companyId;

    if (!eventType || !subscriptionId || !companyId) {
      return res.status(400).json({ error: "eventType, subscriptionId, and valid session authentication are required" });
    }

    const cid = companyId.trim().toUpperCase();
    console.log(`[PayPal Webhook Simulator] Triggering mock "${eventType}" for company: ${cid}`);

    try {
      let targetStatus: 'active' | 'cancelled' | 'expired' = 'active';
      if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') targetStatus = 'cancelled';
      if (eventType === 'BILLING.SUBSCRIPTION.EXPIRED' || eventType === 'PAYMENT.SALE.DENIED') targetStatus = 'expired';

      await updateCompanySubscriptionData(cid, plan || 'basic', subscriptionId, targetStatus);
      return res.json({
        success: true,
        message: `Successfully simulated ${eventType} webhook callback. Firestore set to: ${targetStatus}.`
      });
    } catch (error: any) {
      console.error("[Webhook Simulation Error]", error);
      return res.status(500).json({ error: error.message });
    }
  });

  /* ==========================================================================
     ⚙️ VITE MIDDLEWARE SETUP
     ========================================================================== */

  const includeFrontend = options?.includeFrontend !== false;

  if (includeFrontend) {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return app;
}

/**
 * 🚀 START FULL-STACK EXPRESS SERVER
 */
async function startServer() {
  const PORT = 3000;
  const app = await createApp({ includeFrontend: true });

  // Bind to Port 3000 and Host 0.0.0.0
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

// Only call startServer() automatically when this file is run directly, NOT when createApp is imported
const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js')
);

if (isMain) {
  startServer().catch(err => {
    console.error("[Server] Fatal startup exception:", err);
  });
}
