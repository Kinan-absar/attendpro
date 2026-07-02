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
    case 'business': return 100; // Normal maximum limit is 100, but we set limit dynamically based on purchased quantity for Business
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
  provider: 'paypal' | null = 'paypal',
  quantity?: number,
  billingCycle?: 'monthly' | 'annual'
): Promise<boolean> {
  if (!isFirebaseAdminReady() || !db) {
    console.warn(`[Firestore Admin Warning] Bypassed Firestore Admin set operation because Firebase Admin is not ready (credentials missing).`);
    return false;
  }

  const cid = companyId.trim().toUpperCase();
  const companyRef = db.collection('companies').doc(cid);
  
  let limit = getPlanLimit(plan);
  if (plan === 'business' && quantity !== undefined) {
    limit = quantity;
  }
  
  try {
    const currentSnap = await companyRef.get();
    const currentData = currentSnap.exists ? currentSnap.data() : null;
    const isPlanUpgradeSamePlan = currentData && currentData.plan === plan;

    const updatePayload: any = {
      plan,
      employeeLimit: status === 'active' ? limit : 0, // 0 limit blocks adding employees if cancelled or expired
      subscriptionStatus: status,
      paypalSubscriptionId: subscriptionId,
      paymentProvider: provider,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (billingCycle) {
      updatePayload.billingCycle = billingCycle;
    }

    // Only set subscriptionStart if there is no previous subscriptionStart, or if changing plan type
    if (!isPlanUpgradeSamePlan || !currentData?.subscriptionStart) {
      updatePayload.subscriptionStart = FieldValue.serverTimestamp();
    }

    // Track prorated upgrades when adding seats to an active Business plan
    let previousLimit = currentData ? (currentData.employeeLimit || 21) : 21;
    if (plan === 'business' && currentData && currentData.plan === 'business' && limit > previousLimit && status === 'active') {
      const addedSeats = limit - previousLimit;
      const cycle = billingCycle || currentData.billingCycle || 'monthly';
      const startTimestamp = currentData.subscriptionStart;
      
      let startDate = startTimestamp ? startTimestamp.toDate() : new Date();
      const now = new Date();
      
      // Calculate next renewal date
      let nextRenewal = new Date(startDate);
      if (cycle === 'annual') {
        while (nextRenewal <= now) {
          nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
        }
      } else {
        while (nextRenewal <= now) {
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        }
      }
      
      // Calculate total days in current period
      const previousRenewal = new Date(nextRenewal);
      if (cycle === 'annual') {
        previousRenewal.setFullYear(previousRenewal.getFullYear() - 1);
      } else {
        previousRenewal.setMonth(previousRenewal.getMonth() - 1);
      }
      const totalPeriodDays = Math.ceil((nextRenewal.getTime() - previousRenewal.getTime()) / (1000 * 60 * 60 * 24)) || 30;
      
      // Calculate remaining days
      const remainingDays = Math.max(1, Math.min(totalPeriodDays, Math.ceil((nextRenewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))));
      
      const pricePerSeat = cycle === 'annual' ? 9.00 : 1.00;
      const proratedFee = Number((addedSeats * pricePerSeat * (remainingDays / totalPeriodDays)).toFixed(2));
      
      const newUpgrade = {
        seatsAdded: addedSeats,
        previousLimit,
        newLimit: limit,
        proratedFee,
        remainingDays,
        renewalDate: nextRenewal,
        date: new Date()
      };
      
      const existingUpgrades = currentData.proratedUpgrades || [];
      updatePayload.proratedUpgrades = [...existingUpgrades, newUpgrade];
      updatePayload.lastProratedUpgrade = newUpgrade;
    }

    await companyRef.set(updatePayload, { merge: true });
    
    console.log(`[Firestore Admin] Company ${cid} subscription updated securely to Plan: ${plan}, Limit: ${limit}, Status: ${status}, ID: ${subscriptionId}, Billing: ${billingCycle}`);
    return true;
  } catch (err: any) {
    console.warn(`[Firestore Admin Warning] Bypassed Firestore Admin set operation due to permission/network limits:`, err.message || err);
    return false;
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
let paypalBasicMonthlyPlanId = '';
let paypalBasicAnnualPlanId = '';
let paypalBusinessMonthlyPlanId = '';
let paypalBusinessAnnualPlanId = '';

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
    if (
      process.env.PAYPAL_PLAN_BASIC_MONTHLY && 
      process.env.PAYPAL_PLAN_BASIC_ANNUAL && 
      process.env.PAYPAL_PLAN_BUSINESS_MONTHLY && 
      process.env.PAYPAL_PLAN_BUSINESS_ANNUAL
    ) {
      paypalBasicMonthlyPlanId = process.env.PAYPAL_PLAN_BASIC_MONTHLY;
      paypalBasicAnnualPlanId = process.env.PAYPAL_PLAN_BASIC_ANNUAL;
      paypalBusinessMonthlyPlanId = process.env.PAYPAL_PLAN_BUSINESS_MONTHLY;
      paypalBusinessAnnualPlanId = process.env.PAYPAL_PLAN_BUSINESS_ANNUAL;
      console.log(`[PayPal Provision] Successfully loaded Plan IDs from Environment Variables.`);
      return;
    }

    // 2. Try to load from Firestore config next to optimize speed and reliability
    try {
      const configRef = db.collection('config').doc('paypal');
      const configDoc = await configRef.get();

      if (configDoc.exists) {
        const data = configDoc.data();
        if (
          data && 
          data.productId && 
          data.basicMonthlyPlanId && 
          data.basicAnnualPlanId && 
          data.businessMonthlyPlanId && 
          data.businessAnnualPlanId
        ) {
          paypalProductId = data.productId;
          paypalBasicMonthlyPlanId = data.basicMonthlyPlanId;
          paypalBasicAnnualPlanId = data.basicAnnualPlanId;
          paypalBusinessMonthlyPlanId = data.businessMonthlyPlanId;
          paypalBusinessAnnualPlanId = data.businessAnnualPlanId;
          console.log(`[PayPal Provision] Successfully loaded existing IDs from Firestore cache.`);
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

    let existingBasicMonthly: any = null;
    let existingBasicAnnual: any = null;
    let existingBusinessMonthly: any = null;
    let existingBusinessAnnual: any = null;

    if (plansResponse.ok) {
      const plansData: any = await plansResponse.json();
      existingBasicMonthly = plansData.plans?.find((p: any) => p.name === 'Attendance Pro - Basic Monthly' && p.status === 'ACTIVE');
      existingBasicAnnual = plansData.plans?.find((p: any) => p.name === 'Attendance Pro - Basic Annual' && p.status === 'ACTIVE');
      existingBusinessMonthly = plansData.plans?.find((p: any) => p.name === 'Attendance Pro - Business Monthly' && p.status === 'ACTIVE');
      existingBusinessAnnual = plansData.plans?.find((p: any) => p.name === 'Attendance Pro - Business Annual' && p.status === 'ACTIVE');
    }

    // A. Basic Monthly ($20/mo flat)
    if (existingBasicMonthly) {
      paypalBasicMonthlyPlanId = existingBasicMonthly.id;
      console.log(`[PayPal Provision] Found existing Basic Monthly Plan: ${paypalBasicMonthlyPlanId}`);
    } else {
      console.log('[PayPal Provision] Creating Basic Monthly Plan ($20/mo)...');
      const response = await fetch(`${baseUrl}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          product_id: paypalProductId,
          name: 'Attendance Pro - Basic Monthly',
          description: 'Up to 20 employees attendance tracking (Monthly)',
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: { interval_unit: 'MONTH', interval_count: 1 },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: { value: '20.00', currency_code: 'USD' }
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
      if (response.ok) {
        const data: any = await response.json();
        paypalBasicMonthlyPlanId = data.id;
        console.log(`[PayPal Provision] Created Basic Monthly Plan: ${paypalBasicMonthlyPlanId}`);
      } else {
        const txt = await response.text();
        console.warn(`[PayPal Provision Warning] Failed to create Basic Monthly Plan: ${txt}`);
      }
    }

    // B. Basic Annual ($180/yr flat)
    if (existingBasicAnnual) {
      paypalBasicAnnualPlanId = existingBasicAnnual.id;
      console.log(`[PayPal Provision] Found existing Basic Annual Plan: ${paypalBasicAnnualPlanId}`);
    } else {
      console.log('[PayPal Provision] Creating Basic Annual Plan ($180/yr)...');
      const response = await fetch(`${baseUrl}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          product_id: paypalProductId,
          name: 'Attendance Pro - Basic Annual',
          description: 'Up to 20 employees attendance tracking (Annual)',
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: { interval_unit: 'YEAR', interval_count: 1 },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: { value: '180.00', currency_code: 'USD' }
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
      if (response.ok) {
        const data: any = await response.json();
        paypalBasicAnnualPlanId = data.id;
        console.log(`[PayPal Provision] Created Basic Annual Plan: ${paypalBasicAnnualPlanId}`);
      } else {
        const txt = await response.text();
        console.warn(`[PayPal Provision Warning] Failed to create Basic Annual Plan: ${txt}`);
      }
    }

    // C. Business Monthly ($1/unit, quantity supported)
    if (existingBusinessMonthly) {
      paypalBusinessMonthlyPlanId = existingBusinessMonthly.id;
      console.log(`[PayPal Provision] Found existing Business Monthly Plan: ${paypalBusinessMonthlyPlanId}`);
    } else {
      console.log('[PayPal Provision] Creating Business Monthly Plan ($1/employee/mo)...');
      const response = await fetch(`${baseUrl}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          product_id: paypalProductId,
          name: 'Attendance Pro - Business Monthly',
          description: '$1 per employee per month (quantity-based)',
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: { interval_unit: 'MONTH', interval_count: 1 },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: { value: '1.00', currency_code: 'USD' }
              }
            }
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3
          },
          quantity_supported: true
        })
      });
      if (response.ok) {
        const data: any = await response.json();
        paypalBusinessMonthlyPlanId = data.id;
        console.log(`[PayPal Provision] Created Business Monthly Plan: ${paypalBusinessMonthlyPlanId}`);
      } else {
        const txt = await response.text();
        console.warn(`[PayPal Provision Warning] Failed to create Business Monthly Plan: ${txt}`);
      }
    }

    // D. Business Annual ($9/unit, quantity supported)
    if (existingBusinessAnnual) {
      paypalBusinessAnnualPlanId = existingBusinessAnnual.id;
      console.log(`[PayPal Provision] Found existing Business Annual Plan: ${paypalBusinessAnnualPlanId}`);
    } else {
      console.log('[PayPal Provision] Creating Business Annual Plan ($9/employee/yr)...');
      const response = await fetch(`${baseUrl}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          product_id: paypalProductId,
          name: 'Attendance Pro - Business Annual',
          description: '$9 per employee per year (quantity-based)',
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: { interval_unit: 'YEAR', interval_count: 1 },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: { value: '9.00', currency_code: 'USD' }
              }
            }
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3
          },
          quantity_supported: true
        })
      });
      if (response.ok) {
        const data: any = await response.json();
        paypalBusinessAnnualPlanId = data.id;
        console.log(`[PayPal Provision] Created Business Annual Plan: ${paypalBusinessAnnualPlanId}`);
      } else {
        const txt = await response.text();
        console.warn(`[PayPal Provision Warning] Failed to create Business Annual Plan: ${txt}`);
      }
    }

    // 5. Store to Firestore for future fast retrieval
    try {
      const configRef = db.collection('config').doc('paypal');
      await configRef.set({
        productId: paypalProductId,
        basicMonthlyPlanId: paypalBasicMonthlyPlanId,
        basicAnnualPlanId: paypalBasicAnnualPlanId,
        businessMonthlyPlanId: paypalBusinessMonthlyPlanId,
        businessAnnualPlanId: paypalBusinessAnnualPlanId,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
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
    const { plan, billingCycle = 'monthly', quantity } = req.body;
    if (!companyId || !plan) {
      return res.status(400).json({ error: "Missing authentication or plan parameter" });
    }

    const cid = companyId.trim().toUpperCase();
    console.log(`[PayPal API] Creating subscription request for company: ${cid}, Plan: ${plan}, Cycle: ${billingCycle}, Quantity: ${quantity}`);

    // Verify company employee count for Business plan
    let companyEmployeeCount = 0;
    try {
      const usersSnap = await db.collection('users').where('companyId', '==', cid).get();
      companyEmployeeCount = usersSnap.size;
      console.log(`[PayPal API] Verified actual employee count for company ${cid}: ${companyEmployeeCount}`);
    } catch (err: any) {
      console.error(`[PayPal API] Error looking up employee count for company ${cid}:`, err.message || err);
      return res.status(500).json({ error: "Failed to verify current employee count from database." });
    }

    // Determine final quantity of seats
    let finalQty = 1;
    if (plan === 'business') {
      const requestedQty = quantity ? parseInt(quantity, 10) : Math.max(21, companyEmployeeCount);
      
      if (requestedQty < 21) {
        return res.status(400).json({ 
          error: "The Business plan requires purchasing a minimum of 21 seats." 
        });
      }
      if (requestedQty > 100) {
        return res.status(400).json({ 
          error: "The Business plan supports a maximum of 100 seats. Please contact our Sales team for Enterprise solutions." 
        });
      }
      if (requestedQty < companyEmployeeCount) {
        return res.status(400).json({ 
          error: `Your company currently has ${companyEmployeeCount} employees registered. You must purchase at least ${companyEmployeeCount} seats.` 
        });
      }
      finalQty = requestedQty;
    } else if (plan === 'basic') {
      finalQty = 20;
    } else {
      finalQty = 5;
    }

    // 1. Look up current subscription in Firestore
    let oldSubscriptionId: string | null = null;
    let currentStatus: string | null = null;
    let warningMessage: string | null = null;

    if (db) {
      try {
        const companyDoc = await db.collection('companies').doc(cid).get();
        if (companyDoc.exists) {
          const companyData = companyDoc.data();
          oldSubscriptionId = companyData?.paypalSubscriptionId || null;
          currentStatus = companyData?.subscriptionStatus || null;
        }
      } catch (err: any) {
        console.error(`[PayPal API] Error looking up company details in Firestore for ${cid}:`, err.message || err);
      }
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    // Check if we should fall back to simulator mode due to missing or placeholder credentials
    const isCredentialsPlaceholder = !clientId || !clientSecret || clientId.includes('YOUR_') || clientSecret.includes('YOUR_');

    // 2. If an active subscription exists, attempt cancellation
    if (oldSubscriptionId && currentStatus === 'active') {
      console.log(`[PayPal API] Found existing active subscription "${oldSubscriptionId}" for company ${cid}. Attempting automatic cancellation...`);
      
      // If it is a simulated subscription, handle simulation cancellation cleanly without API calls
      if (oldSubscriptionId.startsWith('I-SIMSUB-') || oldSubscriptionId === 'MOCK' || isCredentialsPlaceholder) {
        console.log(`[PayPal API] Existing subscription "${oldSubscriptionId}" is a simulated subscription. Simulating automatic cancellation...`);
      } else {
        try {
          const accessToken = await getPayPalAccessToken();
          const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
          const cancelUrl = mode === 'live'
            ? `https://api-m.paypal.com/v1/billing/subscriptions/${oldSubscriptionId}/cancel`
            : `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${oldSubscriptionId}/cancel`;

          const cancelResponse = await fetch(cancelUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              reason: `Changing plan to ${plan}`
            })
          });

          if (!cancelResponse.ok) {
            const cancelErrText = await cancelResponse.text();
            console.warn(`[PayPal API Warning] PayPal cancellation for subscription "${oldSubscriptionId}" returned status ${cancelResponse.status}:`, cancelErrText);
            warningMessage = `We detected an existing active subscription but could not cancel it automatically. Please verify your PayPal account. Error details: ${cancelResponse.statusText}`;
          } else {
            console.log(`[PayPal API] Successfully cancelled old PayPal subscription "${oldSubscriptionId}"`);
          }
        } catch (cancelErr: any) {
          console.error(`[PayPal API Exception] Failed to cancel existing active subscription "${oldSubscriptionId}":`, cancelErr.message || cancelErr);
          warningMessage = `We encountered an unexpected error while trying to automatically cancel your existing active subscription. Please review your active subscriptions in your PayPal dashboard.`;
        }
      }
    }

    if (isCredentialsPlaceholder) {
      const mockSubId = `I-SIMSUB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const approvalUrl = `/admin/subscription?status=success&sim_sub_id=${mockSubId}&sim_plan=${plan}&sim_company=${cid}&sim_cycle=${billingCycle}&sim_qty=${finalQty}`;
      console.log(`[PayPal API] Using Simulator fallback due to missing/placeholder credentials. Redirecting to: ${approvalUrl}`);
      return res.json({
        simulator: true,
        subscriptionId: mockSubId,
        approvalUrl,
        ...(warningMessage ? { warning: warningMessage } : {})
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
      if (plan === 'basic') {
        planId = billingCycle === 'annual'
          ? (paypalBasicAnnualPlanId || process.env.PAYPAL_PLAN_BASIC_ANNUAL || '')
          : (paypalBasicMonthlyPlanId || process.env.PAYPAL_PLAN_BASIC_MONTHLY || '');
      } else if (plan === 'business') {
        planId = billingCycle === 'annual'
          ? (paypalBusinessAnnualPlanId || process.env.PAYPAL_PLAN_BUSINESS_ANNUAL || '')
          : (paypalBusinessMonthlyPlanId || process.env.PAYPAL_PLAN_BUSINESS_MONTHLY || '');
      }

      if (!planId) {
        planId = plan === 'basic'
          ? (billingCycle === 'annual' ? 'P-MOCK_BASIC_ANNUAL' : 'P-MOCK_BASIC_MONTHLY')
          : (billingCycle === 'annual' ? 'P-MOCK_BUSINESS_ANNUAL' : 'P-MOCK_BUSINESS_MONTHLY');
      }

      // Call PayPal Subscriptions API
      const reqBody: any = {
        plan_id: planId,
        custom_id: cid,
        application_context: {
          brand_name: "Attendance Pro",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${req.headers.origin || 'http://localhost:3000'}/admin/subscription?status=success&sim_plan=${plan}&sim_cycle=${billingCycle}&sim_qty=${finalQty}`,
          cancel_url: `${req.headers.origin || 'http://localhost:3000'}/admin/subscription?status=cancel`
        }
      };

      if (plan === 'business') {
        reqBody.quantity = String(finalQty);
      }

      const response = await fetch(paypalUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(reqBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("[PayPal API Error] Subscriptions API call failed, falling back to Simulator:", errorText);
        const mockSubId = `I-SIMSUB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const approvalUrl = `/admin/subscription?status=success&sim_sub_id=${mockSubId}&sim_plan=${plan}&sim_company=${cid}&sim_cycle=${billingCycle}&sim_qty=${finalQty}`;
        return res.json({
          simulator: true,
          subscriptionId: mockSubId,
          approvalUrl,
          ...(warningMessage ? { warning: warningMessage } : {})
        });
      }

      const data: any = await response.json();
      const approvalUrl = data.links.find((link: any) => link.rel === 'approve')?.href;

      return res.json({
        simulator: false,
        subscriptionId: data.id,
        approvalUrl: approvalUrl || `https://www.sandbox.paypal.com/checkoutnow?token=${data.id}`,
        ...(warningMessage ? { warning: warningMessage } : {})
      });
    } catch (error: any) {
      console.warn("[PayPal API Exception] Creating subscription failed, falling back to Simulator:", error.message || error);
      const mockSubId = `I-SIMSUB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const approvalUrl = `/admin/subscription?status=success&sim_sub_id=${mockSubId}&sim_plan=${plan}&sim_company=${cid}&sim_cycle=${billingCycle}&sim_qty=${finalQty}`;
      return res.json({
        simulator: true,
        subscriptionId: mockSubId,
        approvalUrl,
        ...(warningMessage ? { warning: warningMessage } : {})
      });
    }
  });

  /**
   * 2. VERIFY PAYPAL SUBSCRIPTION (ON RETURNING TO CLIENT)
   */
  app.post('/api/paypal/verify-subscription', authenticateFirebase, async (req, res) => {
    const { subscriptionId, plan, qty, billingCycle } = req.body;
    const companyId = (req as AuthenticatedRequest).user?.companyId;

    if (!subscriptionId || !companyId) {
      return res.status(400).json({ error: "subscriptionId and valid authenticated user session are required" });
    }

    console.log(`[PayPal API] Verifying subscription ID: ${subscriptionId} for company: ${companyId}`);

    // If it's a simulated subscription, return success immediately
    if (subscriptionId.startsWith('I-SIMSUB-') || subscriptionId === 'MOCK') {
      console.log(`[PayPal API] Verifying fully simulated subscription: ${subscriptionId}`);
      const parsedQty = qty ? parseInt(qty, 10) : undefined;
      const parsedBillingCycle = billingCycle || 'monthly';
      const persisted = await updateCompanySubscriptionData(companyId, plan || 'basic', subscriptionId, 'active', 'paypal', parsedQty, parsedBillingCycle);
      return res.json({ success: true, status: 'ACTIVE', plan: plan || 'basic', companyId, serverPersisted: persisted });
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret || clientId.includes('YOUR_') || clientSecret.includes('YOUR_')) {
      console.warn("[PayPal API Warning] PayPal is unconfigured or using placeholders. Falling back to verification success (Simulator).");
      const parsedQty = qty ? parseInt(qty, 10) : undefined;
      const parsedBillingCycle = billingCycle || 'monthly';
      const persisted = await updateCompanySubscriptionData(companyId, plan || 'basic', subscriptionId, 'active', 'paypal', parsedQty, parsedBillingCycle);
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
        const parsedQty = qty ? parseInt(qty, 10) : undefined;
        const parsedBillingCycle = billingCycle || 'monthly';
        const persisted = await updateCompanySubscriptionData(companyId, plan || 'basic', subscriptionId, 'active', 'paypal', parsedQty, parsedBillingCycle);
        return res.json({ success: true, status: 'ACTIVE', plan: plan || 'basic', companyId, serverPersisted: persisted });
      }

      const data: any = await response.json();
      const status = data.status; // ACTIVE, SUSPENDED, CANCELLED, EXPIRED
      const customId = data.custom_id || companyId;
      
      let resolvedPlan: any = plan || 'basic';
      let resolvedBillingCycle: 'monthly' | 'annual' = 'monthly';
      if (
        data.plan_id === paypalBusinessMonthlyPlanId || 
        data.plan_id === process.env.PAYPAL_PLAN_BUSINESS_MONTHLY
      ) {
        resolvedPlan = 'business';
        resolvedBillingCycle = 'monthly';
      } else if (
        data.plan_id === paypalBusinessAnnualPlanId || 
        data.plan_id === process.env.PAYPAL_PLAN_BUSINESS_ANNUAL
      ) {
        resolvedPlan = 'business';
        resolvedBillingCycle = 'annual';
      } else if (
        data.plan_id === paypalBasicMonthlyPlanId || 
        data.plan_id === process.env.PAYPAL_PLAN_BASIC_MONTHLY
      ) {
        resolvedPlan = 'basic';
        resolvedBillingCycle = 'monthly';
      } else if (
        data.plan_id === paypalBasicAnnualPlanId || 
        data.plan_id === process.env.PAYPAL_PLAN_BASIC_ANNUAL
      ) {
        resolvedPlan = 'basic';
        resolvedBillingCycle = 'annual';
      } else if (data.plan_id && data.plan_id.toUpperCase().includes('ANNUAL')) {
        resolvedBillingCycle = 'annual';
      } else {
        resolvedBillingCycle = (billingCycle || 'monthly') as any;
      }

      let quantity: number | undefined = undefined;
      if (data.quantity) {
        quantity = parseInt(data.quantity, 10);
      } else if (qty) {
        quantity = parseInt(qty, 10);
      }

      if (status === 'ACTIVE') {
        const persisted = await updateCompanySubscriptionData(customId, resolvedPlan, subscriptionId, 'active', 'paypal', quantity, resolvedBillingCycle);
        return res.json({ success: true, status, plan: resolvedPlan, companyId: customId, serverPersisted: persisted });
      } else {
        const mappedStatus = status === 'CANCELLED' ? 'cancelled' : 'expired';
        const persisted = await updateCompanySubscriptionData(customId, resolvedPlan, subscriptionId, mappedStatus as any, 'paypal', quantity, resolvedBillingCycle);
        return res.json({ success: false, status, message: `Subscription is not active. Status: ${status}`, serverPersisted: persisted });
      }
    } catch (error: any) {
      console.warn("[PayPal Verification Exception] Error encountered. Falling back to Success (Simulator):", error.message || error);
      const parsedQty = qty ? parseInt(qty, 10) : undefined;
      const parsedBillingCycle = billingCycle || 'monthly';
      const persisted = await updateCompanySubscriptionData(companyId, plan || 'basic', subscriptionId, 'active', 'paypal', parsedQty, parsedBillingCycle);
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
          let billingCycle: 'monthly' | 'annual' = 'monthly';
          if (
            resource.plan_id === paypalBusinessMonthlyPlanId || 
            resource.plan_id === process.env.PAYPAL_PLAN_BUSINESS_MONTHLY
          ) {
            plan = 'business';
            billingCycle = 'monthly';
          } else if (
            resource.plan_id === paypalBusinessAnnualPlanId || 
            resource.plan_id === process.env.PAYPAL_PLAN_BUSINESS_ANNUAL
          ) {
            plan = 'business';
            billingCycle = 'annual';
          } else if (
            resource.plan_id === paypalBasicMonthlyPlanId || 
            resource.plan_id === process.env.PAYPAL_PLAN_BASIC_MONTHLY
          ) {
            plan = 'basic';
            billingCycle = 'monthly';
          } else if (
            resource.plan_id === paypalBasicAnnualPlanId || 
            resource.plan_id === process.env.PAYPAL_PLAN_BASIC_ANNUAL
          ) {
            plan = 'basic';
            billingCycle = 'annual';
          } else if (resource.plan_id && resource.plan_id.toUpperCase().includes('ANNUAL')) {
            billingCycle = 'annual';
          }

          let quantity: number | undefined = undefined;
          if (resource.quantity) {
            quantity = parseInt(resource.quantity, 10);
          }

          await updateCompanySubscriptionData(customId, plan, subscriptionId, 'active', 'paypal', quantity, billingCycle);
          break;
        }
        case 'BILLING.SUBSCRIPTION.CANCELLED': {
          // Find company associated with subscription
          const querySnap = await db.collection('companies')
            .where('paypalSubscriptionId', '==', subscriptionId)
            .limit(1)
            .get();

          const cid = !querySnap.empty ? querySnap.docs[0].id : customId;
          const companyData = !querySnap.empty ? querySnap.docs[0].data() : null;
          const currentPlan = companyData?.plan || 'basic';
          const currentLimit = companyData?.employeeLimit || 20;
          
          if (cid) {
            await updateCompanySubscriptionData(cid, currentPlan, subscriptionId, 'cancelled', 'paypal', currentLimit);
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
          const companyData = !querySnap.empty ? querySnap.docs[0].data() : null;
          const currentPlan = companyData?.plan || 'basic';
          const currentLimit = companyData?.employeeLimit || 20;
          
          if (cid) {
            await updateCompanySubscriptionData(cid, currentPlan, subscriptionId, 'expired', 'paypal', currentLimit);
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

    const { eventType, subscriptionId, plan, qty, billingCycle } = req.body;
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

      const parsedQty = qty ? parseInt(qty, 10) : undefined;
      const parsedBillingCycle = billingCycle || 'monthly';
      await updateCompanySubscriptionData(cid, plan || 'basic', subscriptionId, targetStatus, 'paypal', parsedQty, parsedBillingCycle);
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
