import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Company, User } from '../types';
import { useLanguage } from '../utils/LanguageContext';
import { useDialog } from '../utils/DialogContext';

interface Props {
  currentUser?: User;
  onRefreshUser?: () => void;
}

const Subscription: React.FC<Props> = ({ currentUser, onRefreshUser }) => {
  const { t, isRtl, language } = useLanguage();
  const { showAlert, showConfirm } = useDialog();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [businessSeats, setBusinessSeats] = useState<number>(25);
  const [businessSeatsInput, setBusinessSeatsInput] = useState<string>("25");
  const [additionalSeatsInput, setAdditionalSeatsInput] = useState<string>("5");

  useEffect(() => {
    if (company) {
      const initialQty = Math.max(21, company.employeeCount || 0);
      setBusinessSeats(initialQty);
      setBusinessSeatsInput(String(initialQty));
    }
  }, [company]);

  // Local translations for subscription-specific terms
  const sT = (key: string): string => {
    const localTrans: Record<string, Record<string, string>> = {
      en: {
        title: "PayPal Subscription Hub",
        sub: "SaaS Multi-tenant workspace subscription and automated employee limits.",
        currentPlan: "Current Plan",
        usage: "Employee Limit Usage",
        limitReached: "Limit Reached! Upgrade now to add more staff.",
        remainingSlots: "remaining slots",
        unlimited: "Unlimited",
        upgradeBtn: "Subscribe with PayPal",
        enterpriseBtn: "Contact Sales",
        currentActive: "Active (Current)",
        active: "Active",
        trial: "Trial",
        expired: "Expired / Unpaid",
        cancelled: "Cancelled",
        freeName: "Free Starter",
        freeDesc: "Standard offline-capable logging for micro operations.",
        freePrice: "$0",
        freePeriod: "forever",
        freeLimit: "Up to 5 Employees",
        basicName: "Basic Growth",
        basicDesc: "Great for growing small teams requiring robust tracking.",
        basicPrice: billingCycle === 'annual' ? "$180" : "$20",
        basicPeriod: billingCycle === 'annual' ? "per year ($15/mo)" : "per month",
        basicLimit: "Up to 20 Employees",
        businessName: "Business Pro",
        businessDesc: billingCycle === 'annual' 
          ? "For 21-100 employees. Billed annually ($9/yr per employee)."
          : "For 21-100 employees. Billed monthly ($1/mo per employee).",
        businessPrice: billingCycle === 'annual' ? "$9" : "$1",
        businessPeriod: billingCycle === 'annual' ? "per employee / yr" : "per employee / mo",
        businessLimit: "21 to 100 Employees",
        enterpriseName: "Enterprise Max",
        enterpriseDesc: "For companies with 100+ employees. Custom contracts and limitless capacity.",
        enterprisePrice: "Contact Us",
        enterprisePeriod: "tailored pricing",
        enterpriseLimit: "100+ Employees",
        processing: "Contacting PayPal Portal...",
        verifying: "Verifying subscription status...",
        paypalOnly: "Payments powered securely by PayPal Subscriptions.",
        warningTitle: "Subscription Inactive!",
        warningMsg: "Your premium features are suspended and staff registration is blocked. Existing records remain safe.",
        devTitle: "Developer Webhook Sandbox Simulator",
        devDesc: "Because PayPal cannot easily send outbound webhooks directly to this isolated dev environment, use the buttons below to simulate PayPal server webhook callbacks. This verifies that Firestore state updates, reactive banners, and employee blockage logic are fully secure and driven by the backend.",
        simSuccess: "Simulate Webhook Activation",
        simCancel: "Simulate Webhook Cancellation",
        simExpire: "Simulate Webhook Expiration"
      },
      ar: {
        title: "بوابة اشتراكات PayPal",
        sub: "إدارة اشتراكات مساحة العمل المتعددة والتحكم التلقائي في حدود الموظفين.",
        currentPlan: "الخطة الحالية",
        usage: "استهلاك حد الموظفين",
        limitReached: "تم الوصول للحد! قم بالترقية لإضافة موظفين جدد.",
        remainingSlots: "أماكن متبقية",
        unlimited: "غير محدود",
        upgradeBtn: "اشترك بواسطة PayPal",
        enterpriseBtn: "تواصل مع المبيعات",
        currentActive: "نشط (الحالي)",
        active: "نشط",
        trial: "تجريبي",
        expired: "منتهي الصلاحية / غير مدفوع",
        cancelled: "ملغي",
        freeName: "البداية المجانية",
        freeDesc: "مثالية للمؤسسات والشركات متناهية الصغر لتتبع الحضور مجاناً.",
        freePrice: "0 ريال",
        freePeriod: "إلى الأبد",
        freeLimit: "حتى 5 موظفين",
        basicName: "النمو الأساسي",
        basicDesc: "رائعة للفرق الصغيرة المتنامية التي تحتاج إلى تتبع حضور قوي.",
        basicPrice: billingCycle === 'annual' ? "180 دولار" : "20 دولار",
        basicPeriod: billingCycle === 'annual' ? "سنوياً (15$/شهر)" : "شهرياً",
        basicLimit: "حتى 20 موظفاً",
        businessName: "محترفي الأعمال",
        businessDesc: billingCycle === 'annual'
          ? "للشركات من 21-100 موظف. دفع سنوي (9 دولار سنوياً لكل موظف)."
          : "للشركات من 21-100 موظف. دفع شهري (1 دولار شهرياً لكل موظف).",
        businessPrice: billingCycle === 'annual' ? "9 دولار" : "1 دولار",
        businessPeriod: billingCycle === 'annual' ? "لكل موظف / سنة" : "لكل موظف / شهر",
        businessLimit: "من 21 إلى 100 موظف",
        enterpriseName: "المؤسسات الكبرى",
        enterpriseDesc: "للشركات التي تضم أكثر من 100 موظف. عقود مخصصة وسعة غير محدودة.",
        enterprisePrice: "اتصل بنا",
        enterprisePeriod: "أسعار خاصة ومخصصة",
        enterpriseLimit: "أكثر من 100 موظف",
        processing: "جاري الاتصال بـ PayPal...",
        verifying: "جاري التحقق من حالة الاشتراك...",
        paypalOnly: "المدفوعات مؤمنة بالكامل عبر اشتراكات PayPal.",
        warningTitle: "الاشتراك غير نشط!",
        warningMsg: "تم تعليق ميزات الترقية وحظر تسجيل الموظفين الجدد. تظل سجلات الحضور القديمة مرئية وآمنة تماماً.",
        devTitle: "محاكي خطافات خادم PayPal (Webhooks)",
        devDesc: "نظراً لأن PayPal لا يمكنه إرسال خطافات دفع مباشرة إلى بيئة التطوير المعزولة هذه، يمكنك استخدام الأزرار أدناه لمحاكاة استجابة خوادم PayPal. يضمن ذلك أن تحديثات قاعدة البيانات وحظر الموظفين تدار بأمان من الخلفية.",
        simSuccess: "محاكاة تفعيل الاشتراك",
        simCancel: "محاكاة إلغاء الاشتراك",
        simExpire: "محاكاة انتهاء الصلاحية"
      }
    };
    const lang = (language === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
    return localTrans[lang][key] || key;
  };

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const companyId = currentUser?.companyId || 'ABSAR';
      const data = await dataService.getCompanyDetails(companyId);
      if (data) {
        setCompany(data);
      }
    } catch (e) {
      console.error("Failed to load company subscription:", e);
    } finally {
      setLoading(false);
    }
  };

  // Check URL query parameters for returning checkout status
  const handleUrlCallbacks = async () => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const simSubId = params.get('sim_sub_id');
    const simPlan = params.get('sim_plan');
    const simCompany = params.get('sim_company');
    const simQty = params.get('sim_qty');

    if (status === 'success') {
      setIsProcessing(true);
      try {
        const subId = simSubId || params.get('subscription_id') || 'MOCK';
        const targetPlan = simPlan || 'basic';
        const targetCompany = simCompany || currentUser?.companyId || 'ABSAR';
        const targetQty = simQty ? parseInt(simQty, 10) : undefined;

        console.log(`[Subscription Page] Verifying checkout return. Sub ID: ${subId}, Plan: ${targetPlan}, Company: ${targetCompany}, Qty: ${targetQty}`);
        
        const targetCycle = params.get('sim_cycle') || billingCycle;
        const result = await dataService.verifyPayPalSubscription(subId, targetPlan, targetQty, targetCycle);
        if (result.success) {
          await showAlert(
            language === 'ar' ? "تم التنشيط!" : "Subscription Activated!", 
            language === 'ar' 
              ? "تم التحقق من اشتراك PayPal الخاص بك وتفعيله بنجاح." 
              : "Your PayPal subscription has been securely verified and is now fully active.", 
            "success"
          );
        } else {
          await showAlert(
            "Verification Incomplete", 
            result.error || "Subscription verification failed or was rejected by the server.", 
            "error"
          );
        }
      } catch (err: any) {
        console.error("Callback verification failed:", err);
        await showAlert("Error", err.message || "Failed to verify PayPal subscription", "error");
      } finally {
        setIsProcessing(false);
        // Clear search parameters from URL so refreshes don't re-trigger verification
        window.history.replaceState({}, document.title, window.location.pathname);
        await fetchCompanyData();
        if (onRefreshUser) onRefreshUser();
      }
    } else if (status === 'cancel') {
      await showAlert(
        language === 'ar' ? "تم الإلغاء" : "Checkout Cancelled", 
        language === 'ar' ? "تم إلغاء عملية الدفع عبر PayPal." : "You cancelled the PayPal subscription setup.", 
        "info"
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      handleUrlCallbacks();
    }
  }, [currentUser]);

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') {
      // Free is self-service downgrading if confirmed
      const confirmed = await showConfirm(
        language === 'ar' ? "تأكيد تخفيض الاشتراك" : "Confirm Downgrade",
        language === 'ar' 
          ? "هل أنت متأكد من رغبتك في العودة للخطة المجانية؟ سيتم تخفيض حد الموظفين إلى 5 موظفين فورياً."
          : "Are you sure you want to downgrade to the Free Starter plan? Your employee limit will be adjusted to 5 immediately."
      );
      if (!confirmed) return;
      
      setIsProcessing(true);
      try {
        await dataService.updateCompanySubscription(company?.id || 'ABSAR', 'free');
        await showAlert(t('success'), language === 'ar' ? "تم التخفيض بنجاح" : "Successfully downgraded workspace limit.", "success");
        await fetchCompanyData();
        if (onRefreshUser) onRefreshUser();
      } catch (err: any) {
        await showAlert(t('error'), err.message || "Failed to change subscription", "error");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (planId === 'enterprise') {
      const email = "info@absar.sa";
      const subject = encodeURIComponent("Attendance Pro - Enterprise Plan Inquiry");
      const body = encodeURIComponent(`Hello Absar Sales Team,\n\nWe are interested in the Enterprise Max plan for our company: ${company?.id || 'My Company'}.\nOur current employee headcount is ${company?.employeeCount || 100}+.\n\nPlease contact us back to discuss onboarding.\n\nBest regards,\n`);
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      return;
    }

    // PayPal checkout process
    setIsProcessing(true);
    try {
      const response = await dataService.createCheckoutSession(
        planId, 
        billingCycle, 
        planId === 'business' ? businessSeats : undefined
      );
      if (response.approvalUrl) {
        // Redirect user to PayPal approval workflow (either simulated sandbox URL or real sandbox/live)
        window.location.href = response.approvalUrl;
      } else {
        throw new Error("No approval URL received from PayPal API");
      }
    } catch (err: any) {
      await showAlert(t('error'), err.message || "Failed to trigger PayPal flow", "error");
      setIsProcessing(false);
    }
  };

  /**
   * 🖥️ TRIGGER DEVELOPER WEBHOOK SIMULATOR
   */
  const triggerSimulatedWebhook = async (eventType: string, planId: 'basic' | 'business') => {
    if (!company) return;
    setSimulatingWebhook(true);
    try {
      const mockSubId = company.paypalSubscriptionId || `I-SIMSUB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const qty = planId === 'business' ? businessSeats : undefined;
      const result = await dataService.simulateWebhook(eventType, mockSubId, planId, qty, billingCycle);
      
      await showAlert(
        "Simulator Fired", 
        result.message || `Successfully simulated ${eventType} callback. Firestore has updated accordingly.`, 
        "success"
      );
      
      await fetchCompanyData();
      if (onRefreshUser) onRefreshUser();
    } catch (err: any) {
      await showAlert("Simulation Failed", err.message || "Could not invoke simulated backend webhook.", "error");
    } finally {
      setSimulatingWebhook(false);
    }
  };

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-slate-400 font-black text-xs uppercase tracking-widest">{t('scanningPersonnel')}</p>
    </div>
  );

  const plan = company?.plan || 'free';
  const employeeCount = company?.employeeCount ?? 0;
  const employeeLimit = company?.employeeLimit ?? 5;
  const status = company?.subscriptionStatus || 'active';
  const isSuspended = status !== 'active' && plan !== 'free';
  const usagePercentage = employeeLimit === 0 ? 100 : Math.min(100, Math.round((employeeCount / employeeLimit) * 100));

  const plansList = [
    {
      id: 'free',
      name: sT('freeName'),
      price: sT('freePrice'),
      period: sT('freePeriod'),
      desc: sT('freeDesc'),
      limit: sT('freeLimit'),
      bg: 'from-slate-50 to-slate-100',
      text: 'text-slate-900',
      border: 'border-slate-200'
    },
    {
      id: 'basic',
      name: sT('basicName'),
      price: sT('basicPrice'),
      period: sT('basicPeriod'),
      desc: sT('basicDesc'),
      limit: sT('basicLimit'),
      bg: 'from-indigo-50/50 to-indigo-100/50',
      text: 'text-indigo-900',
      border: 'border-indigo-100'
    },
    {
      id: 'business',
      name: sT('businessName'),
      price: sT('businessPrice'),
      period: sT('businessPeriod'),
      desc: sT('businessDesc'),
      limit: sT('businessLimit'),
      bg: 'from-emerald-50/50 to-emerald-100/50',
      text: 'text-emerald-900',
      border: 'border-emerald-100',
      badge: isRtl ? 'الموصى بها للمجموعات' : 'Headcount Scaled'
    },
    {
      id: 'enterprise',
      name: sT('enterpriseName'),
      price: sT('enterprisePrice'),
      period: sT('enterprisePeriod'),
      desc: sT('enterpriseDesc'),
      limit: sT('enterpriseLimit'),
      bg: 'from-purple-50/50 to-purple-100/50',
      text: 'text-purple-900',
      border: 'border-purple-100'
    }
  ];

  return (
    <div className={`space-y-8 animate-fadeIn pb-20 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* HEADER */}
      <div className="text-start flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <i className="fa-brands fa-paypal text-indigo-600 text-4xl"></i>
            {sT('title')}
          </h1>
          <p className="text-slate-500">{sT('sub')}</p>
        </div>
        <div className="text-slate-400 text-xs font-bold bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl">
          <i className="fa-solid fa-lock text-emerald-500 mr-2"></i>
          {sT('paypalOnly')}
        </div>
      </div>

      {/* SUSPENSION WARNING BANNER */}
      {isSuspended && (
        <div className="p-6 bg-rose-50 border-2 border-rose-100 rounded-[2rem] flex items-start gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0">
            <i className="fa-solid fa-circle-exclamation text-xl"></i>
          </div>
          <div className="text-start">
            <h3 className="font-black text-rose-800 text-base">{sT('warningTitle')} ({status.toUpperCase()})</h3>
            <p className="text-xs text-rose-600 font-bold mt-1 leading-normal">{sT('warningMsg')}</p>
          </div>
        </div>
      )}

      {/* DASHBOARD STATUS CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-xl shadow-slate-100/50 flex flex-col justify-between space-y-4">
          <div className="text-start space-y-2">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sT('currentPlan')}</p>
              <h2 className="text-2xl font-black text-indigo-600 uppercase tracking-tight mt-1">{plan}</h2>
            </div>

            {/* Rich details for subscriber */}
            {plan !== 'free' && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] font-bold text-slate-600">
                <div className="flex justify-between items-center gap-2">
                  <span>{language === 'ar' ? "دورة الفوترة:" : "Billing Cycle:"}</span>
                  <span className="text-slate-900 font-extrabold capitalize">
                    {company?.billingCycle === 'annual' 
                      ? (language === 'ar' ? "سنوي" : "Annual") 
                      : (language === 'ar' ? "شهري" : "Monthly")
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span>{language === 'ar' ? "معدل السعر:" : "Price Rate:"}</span>
                  <span className="text-slate-900 font-extrabold">
                    {plan === 'business'
                      ? (company?.billingCycle === 'annual' ? "$9 / seat / yr" : "$1 / seat / mo")
                      : (company?.billingCycle === 'annual' ? "$180 / yr" : "$20 / mo")
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span>{language === 'ar' ? "المقاعد الإجمالية:" : "Total Seats:"}</span>
                  <span className="text-slate-900 font-extrabold">
                    {plan === 'business' ? `${employeeLimit} seats` : "20 seats"}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span>{language === 'ar' ? "قيمة الفاتورة:" : "Total Billing:"}</span>
                  <span className="text-slate-900 font-extrabold">
                    {plan === 'business' 
                      ? `$${employeeLimit * (company?.billingCycle === 'annual' ? 9 : 1)} / ${company?.billingCycle === 'annual' ? 'yr' : 'mo'}`
                      : (company?.billingCycle === 'annual' ? "$180 / yr" : "$20 / mo")
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 truncate">
                  <span className="shrink-0">{language === 'ar' ? "رقم الاشتراك:" : "Sub ID:"}</span>
                  <span className="text-slate-500 text-[10px] font-mono select-all truncate max-w-[110px] text-end" title={company?.paypalSubscriptionId || ""}>
                    {company?.paypalSubscriptionId || "N/A"}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest gap-1.5 leading-none ${
              status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <i className="fa-solid fa-circle text-[6px] animate-pulse"></i>
              {status === 'active' ? sT('active') : status === 'cancelled' ? sT('cancelled') : sT('expired')}
            </span>
            <span className="text-[10px] font-bold text-slate-400">{t('companyIdFieldLabel')}: <strong className="text-slate-800">{company?.id}</strong></span>
          </div>
        </div>

        <div className="md:col-span-2 p-6 bg-white border border-slate-100 rounded-[2rem] shadow-xl shadow-slate-100/50 flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <div className="text-start">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sT('usage')}</p>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                {employeeCount} / <span className="text-slate-400 font-bold">{employeeLimit >= 999999 ? sT('unlimited') : employeeLimit}</span>
              </h2>
            </div>
            {employeeCount >= employeeLimit && (
              <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-xl font-black text-[9px] uppercase tracking-widest">
                ⚠ {sT('limitReached')}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isSuspended ? 'bg-slate-300 w-0' : usagePercentage >= 90 ? 'bg-rose-500' : usagePercentage >= 75 ? 'bg-amber-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${isSuspended ? 0 : usagePercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>{isSuspended ? '0% active limit' : `${usagePercentage}% used`}</span>
              {employeeLimit < 999999 && employeeLimit > 0 && (
                <span>{Math.max(0, employeeLimit - employeeCount)} {sT('remainingSlots')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BILLING CYCLE TOGGLE */}
      <div className="flex justify-center items-center gap-4 py-6 bg-slate-50 rounded-[2rem] border border-slate-100">
        <span className={`text-sm font-black transition-colors ${billingCycle === 'monthly' ? 'text-indigo-600' : 'text-slate-400'}`}>
          {language === 'ar' ? "دورة دفع شهرية" : "Monthly Billing"}
        </span>
        <button
          type="button"
          onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
          className="w-14 h-8 bg-slate-200 rounded-full p-1 transition-colors duration-300 relative focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Toggle Billing Cycle"
        >
          <div
            className={`w-6 h-6 rounded-full transition-all duration-300 shadow-md ${
              billingCycle === 'annual' ? 'translate-x-6 bg-emerald-600' : 'translate-x-0 bg-indigo-600'
            }`}
          />
        </button>
        <span className={`text-sm font-black flex items-center gap-2 transition-colors ${billingCycle === 'annual' ? 'text-emerald-600' : 'text-slate-400'}`}>
          {language === 'ar' ? "دورة دفع سنوية" : "Annual Billing"}
          <span className="px-2.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 font-black rounded-full animate-pulse">
            {language === 'ar' ? "وفر 25%" : "Save 25%"}
          </span>
        </span>
      </div>

      {/* PLAN CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plansList.map((p) => {
          const isCurrent = p.id === plan;
          return (
            <div 
              key={p.id} 
              className={`p-6 bg-gradient-to-b ${p.bg} border-2 ${
                isCurrent && !isSuspended ? 'border-indigo-600 scale-[1.02] shadow-2xl shadow-indigo-100/35' : p.border
              } rounded-[2.5rem] flex flex-col justify-between relative transition-all duration-300 hover:scale-[1.01]`}
            >
              {p.badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md">
                  {p.badge}
                </span>
              )}

              <div className="space-y-4 text-start">
                <div className="space-y-1">
                  <h3 className="font-black text-lg text-slate-900">{p.name}</h3>
                  <p className="text-xs text-slate-400 font-bold leading-normal min-h-[3rem]">{p.desc}</p>
                </div>

                <div className="py-2">
                  <span className="text-4xl font-black tracking-tight text-slate-900">{p.price}</span>
                  <span className="text-slate-400 font-bold text-xs uppercase ml-1.5 block mt-1">{p.period}</span>
                  {p.id === 'business' && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider">
                        {language === 'ar' ? 'حدد عدد المقاعد (الموظفين):' : 'Select Employee Seats:'}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = Math.max(Math.max(21, employeeCount), businessSeats - 1);
                            setBusinessSeats(nextVal);
                            setBusinessSeatsInput(String(nextVal));
                          }}
                          disabled={businessSeats <= Math.max(21, employeeCount)}
                          className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          -
                        </button>
                        <input
                          type="text"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          value={businessSeatsInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) {
                              setBusinessSeatsInput(val);
                            }
                          }}
                          onBlur={() => {
                            const val = parseInt(businessSeatsInput, 10);
                            if (isNaN(val)) {
                              const fallback = Math.max(21, employeeCount);
                              setBusinessSeats(fallback);
                              setBusinessSeatsInput(String(fallback));
                            } else {
                              const clamped = Math.min(100, Math.max(Math.max(21, employeeCount), val));
                              setBusinessSeats(clamped);
                              setBusinessSeatsInput(String(clamped));
                            }
                          }}
                          className="w-16 text-center border border-slate-300 rounded-lg py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = Math.min(100, businessSeats + 1);
                            setBusinessSeats(nextVal);
                            setBusinessSeatsInput(String(nextVal));
                          }}
                          disabled={businessSeats >= 100}
                          className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                      
                      <div className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-3 py-2.5 rounded-xl block border border-emerald-100/50 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <i className="fa-solid fa-calculator"></i>
                          <span>
                            {language === 'ar'
                              ? `التكلفة: ${businessSeats * (billingCycle === 'annual' ? 9 : 1)} دولار / ${billingCycle === 'annual' ? 'سنة' : 'شهر'}`
                              : `Total Cost: $${businessSeats * (billingCycle === 'annual' ? 9 : 1)} / ${billingCycle === 'annual' ? 'yr' : 'mo'}`
                            }
                          </span>
                        </div>
                        <div className="text-[9px] text-emerald-600 font-bold">
                          {language === 'ar'
                            ? `(مخصص لـ ${businessSeats} مقعداً لشركتك التي بها ${employeeCount} موظفاً حالياً)`
                            : `(Configured for ${businessSeats} seats; currently has ${employeeCount} staff)`
                          }
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/55 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <i className="fa-solid fa-circle-check text-indigo-500 text-sm"></i>
                    <span>{p.limit}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <i className="fa-solid fa-circle-check text-indigo-500 text-sm"></i>
                    <span>{isRtl ? 'دعم كامل للنظام الجغرافي' : 'Full geofencing support'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <i className="fa-solid fa-circle-check text-indigo-500 text-sm"></i>
                    <span>{isRtl ? 'تقارير رواتب مدد / WPS' : 'Saudi WPS Mudad exports'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                {isCurrent && !isSuspended ? (
                  <div className="w-full py-3.5 px-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest text-center shadow-inner flex items-center justify-center leading-none">
                    {sT('currentActive')}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubscribe(p.id)}
                    disabled={isProcessing}
                    className={`w-full py-3.5 px-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center leading-none text-center ${
                      p.id === 'free' 
                        ? 'bg-slate-600 hover:bg-slate-700 hover:shadow-slate-500/20' 
                        : p.id === 'enterprise' 
                          ? 'bg-purple-600 hover:bg-purple-700 hover:shadow-purple-500/20' 
                          : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/20'
                    }`}
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                        {sT('processing')}
                      </span>
                    ) : p.id === 'enterprise' ? (
                      sT('enterpriseBtn')
                    ) : (
                      sT('upgradeBtn')
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MANAGE BUSINESS SEATS (ONLY FOR ACTIVE BUSINESS PLAN) */}
      {plan === 'business' && status === 'active' && (() => {
        const cycle = company?.billingCycle || 'monthly';
        const start = company?.subscriptionStart 
          ? new Date(company.subscriptionStart) 
          : (company?.createdAt ? new Date(company.createdAt) : new Date());
        const now = new Date();
        
        // Calculate next renewal date
        let nextRenewal = new Date(start);
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
        const totalPeriodMs = nextRenewal.getTime() - previousRenewal.getTime();
        const totalPeriodDays = Math.ceil(totalPeriodMs / (1000 * 60 * 60 * 24)) || 30;
        
        // Calculate remaining days
        const remainingMs = nextRenewal.getTime() - now.getTime();
        const remainingDays = Math.max(1, Math.min(totalPeriodDays, Math.ceil(remainingMs / (1000 * 60 * 60 * 24))));
        
        const addNum = parseInt(additionalSeatsInput, 10) || 0;
        const pricePerSeat = cycle === 'annual' ? 9.00 : 1.00;
        const proratedCostPerSeat = pricePerSeat * (remainingDays / totalPeriodDays);
        const totalProratedUpgradeFee = Number((addNum * proratedCostPerSeat).toFixed(2));
        const nextRecurringBillAmount = (employeeLimit + addNum) * pricePerSeat;

        const formattedRenewalDate = nextRenewal.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        return (
          <div className="space-y-6">
            <div className="p-8 bg-gradient-to-r from-emerald-50/60 to-teal-50/60 border-2 border-emerald-500/30 rounded-[2.5rem] text-start space-y-6 shadow-xl shadow-emerald-100/20">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                  <i className="fa-solid fa-users-gear text-lg"></i>
                </span>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    {language === 'ar' ? "إدارة مقاعد خطة الأعمال مع الحساب النسبي (Prorata)" : "Manage Business Seats with Proration"}
                  </h2>
                  <p className="text-xs text-slate-500 font-bold">
                    {language === 'ar' 
                      ? "اشترِ مقاعد إضافية فورية مخصومة بناءً على الأيام المتبقية في دورتك الحالية." 
                      : "Purchase immediate additional seats, discounted based on remaining days in your current billing cycle."
                    }
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                {/* CURRENT SEATS (READ-ONLY) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {language === 'ar' ? "المقاعد الحالية (للقراءة فقط):" : "Current Purchased Seats (Read-only):"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={employeeLimit}
                      className="w-full bg-slate-50 text-slate-600 font-mono font-black text-center py-2.5 rounded-xl border border-slate-200 cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {language === 'ar' 
                      ? `(حالياً تم تسجيل ${employeeCount} موظفاً)` 
                      : `(${employeeCount} staff registered currently)`
                    }
                  </p>
                </div>

                {/* ADDITIONAL SEATS INPUT */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-2">
                  <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                    {language === 'ar' ? "إضافة مقاعد جديدة:" : "Add New Seats:"}
                  </label>
                  <div className="flex items-center justify-between gap-2 bg-slate-50/50 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        const currentVal = parseInt(additionalSeatsInput, 10) || 0;
                        const nextVal = Math.max(1, currentVal - 1);
                        setAdditionalSeatsInput(String(nextVal));
                      }}
                      className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={additionalSeatsInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d+$/.test(val)) {
                          setAdditionalSeatsInput(val);
                        }
                      }}
                      onBlur={() => {
                        const val = parseInt(additionalSeatsInput, 10);
                        if (isNaN(val) || val < 1) {
                          setAdditionalSeatsInput("1");
                        } else if (employeeLimit + val > 100) {
                          setAdditionalSeatsInput(String(100 - employeeLimit));
                        }
                      }}
                      className="w-16 bg-transparent text-center font-black text-sm text-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const currentVal = parseInt(additionalSeatsInput, 10) || 0;
                        const nextVal = Math.min(100 - employeeLimit, currentVal + 1);
                        setAdditionalSeatsInput(String(nextVal));
                      }}
                      disabled={employeeLimit >= 100}
                      className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {language === 'ar' 
                      ? "اكتب الرقم مباشرة أو استخدم أزرار التحكم" 
                      : "Type directly or use adjustment buttons"
                    }
                  </p>
                </div>

                {/* PRO-RATA CALCULATOR DETAILS */}
                <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm space-y-3 text-[11px] font-bold text-slate-600">
                  <div className="text-slate-800 text-xs font-black uppercase tracking-wider pb-1.5 border-b border-slate-100 flex items-center gap-1.5">
                    <i className="fa-solid fa-calculator text-emerald-600"></i>
                    {language === 'ar' ? "تفاصيل الحساب النسبي" : "Pro-Rata Calculations"}
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>{language === 'ar' ? "تاريخ التجديد القادم:" : "Next Renewal Date:"}</span>
                    <span className="text-slate-900 font-black">{formattedRenewalDate}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>{language === 'ar' ? "الأيام المتبقية في الدورة:" : "Days Remaining in Cycle:"}</span>
                    <span className="text-slate-950 font-extrabold">{remainingDays} / {totalPeriodDays} {language === 'ar' ? "يوم" : "days"}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>{language === 'ar' ? "نسبة الخصم:" : "Pro-rata Ratio:"}</span>
                    <span className="text-emerald-700 font-extrabold">{((remainingDays / totalPeriodDays) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>{language === 'ar' ? "سعر المقعد التناسبي:" : "Prorated Seat Rate:"}</span>
                    <span className="text-slate-900 font-black">${proratedCostPerSeat.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* PRORATED GRAND SUMMARY BAR */}
              <div className="p-6 bg-emerald-600 rounded-3xl text-white shadow-lg space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
                <div className="space-y-1.5 text-start">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-700 text-white font-black text-[9px] uppercase tracking-widest leading-none">
                    {language === 'ar' ? "ملخص طلب الترقية" : "UPGRADE ORDER BILLING"}
                  </span>
                  <div className="text-xl font-black tracking-tight">
                    {language === 'ar' ? `المقاعد الجديدة: ${employeeLimit + addNum} مقعداً` : `New Limit: ${employeeLimit + addNum} Total Seats`}
                    <span className="text-sm font-semibold ml-2 text-emerald-100">
                      ({language === 'ar' ? `بإضافة +${addNum} مقعداً` : `Adding +${addNum} seats`})
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-100 font-bold space-y-1">
                    <p>
                      {language === 'ar' 
                        ? `الدفع المستحق اليوم (النسبة المتبقية فقط): $${totalProratedUpgradeFee}`
                        : `Immediate upgrade fee due today (for the remainder of this cycle): $${totalProratedUpgradeFee}`
                      }
                    </p>
                    <p className="opacity-90">
                      {language === 'ar' 
                        ? `الفاتورة الدورية القادمة (مجموع ${employeeLimit + addNum} مقعداً): $${nextRecurringBillAmount} شهرياً تبدأ في ${formattedRenewalDate}`
                        : `Next recurring billing (${employeeLimit + addNum} seats at full rate): $${nextRecurringBillAmount} due on ${formattedRenewalDate}`
                      }
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const targetQty = employeeLimit + addNum;
                      if (targetQty > 100) {
                        await showAlert(
                          t('error'), 
                          language === 'ar' 
                            ? "خطة الأعمال تدعم بحد أقصى 100 موظف. يرجى الاتصال بالمبيعات." 
                            : "Business plan supports up to 100 seats. Contact Sales for Enterprise.", 
                          "error"
                        );
                        return;
                      }

                      const isConfirmed = await showConfirm(
                        language === 'ar' ? "تأكيد ترقية المقاعد النسبية" : "Confirm Prorated Seat Upgrade",
                        language === 'ar'
                          ? `هل أنت متأكد من رغبتك في زيادة المقاعد إلى ${targetQty} مقعداً؟ سيتم احتساب قيمة نسبية قدرها $${totalProratedUpgradeFee} للفترة المتبقية من دورتك الحالية وتحديث اشتراكك.`
                          : `Are you sure you want to increase your company headcount capacity to ${targetQty} seats? This will charge a fair prorated fee of $${totalProratedUpgradeFee} for the remainder of your current period.`
                      );

                      if (isConfirmed) {
                        setIsProcessing(true);
                        try {
                          const response = await dataService.createCheckoutSession(
                            'business', 
                            company?.billingCycle || 'monthly', 
                            targetQty
                          );
                          if (response.approvalUrl) {
                            window.location.href = response.approvalUrl;
                          } else {
                            throw new Error("No approval URL received");
                          }
                        } catch (err: any) {
                          await showAlert(t('error'), err.message || "Failed to trigger PayPal upgrade flow", "error");
                          setIsProcessing(false);
                        }
                      }
                    }}
                    disabled={isProcessing || addNum <= 0}
                    className="w-full md:w-auto py-3 px-6 bg-white text-emerald-700 hover:bg-emerald-50 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center leading-none text-center disabled:opacity-75 shadow-md active:scale-95"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        {sT('processing')}
                      </span>
                    ) : (
                      language === 'ar' ? "تأكيد الترقية والدفع الآن" : "Authorize Prorated Upgrade"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* SEAT PURCHASE HISTORY (IF ANY EXIST IN THE HISTORY ARRAY) */}
            {company?.proratedUpgrades && company.proratedUpgrades.length > 0 && (
              <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] text-start space-y-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <i className="fa-solid fa-receipt text-xs"></i>
                  </span>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                    {language === 'ar' ? "سجل ترقيات المقاعد التناسبية" : "Prorated Seat Upgrade History"}
                  </h3>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 text-center">
                      <tr>
                        <th className="py-3 px-4">{language === 'ar' ? "التاريخ" : "Date"}</th>
                        <th className="py-3 px-4">{language === 'ar' ? "المقاعد المضافة" : "Seats Added"}</th>
                        <th className="py-3 px-4">{language === 'ar' ? "السعة الجديدة" : "New Capacity"}</th>
                        <th className="py-3 px-4">{language === 'ar' ? "الأيام المتبقية" : "Days in Cycle"}</th>
                        <th className="py-3 px-4">{language === 'ar' ? "المبلغ المدفوع (بروراتا)" : "Amount Paid (Prorated)"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-center font-bold">
                      {company.proratedUpgrades.map((upgrade: any, idx: number) => {
                        const dateObj = upgrade.date ? (upgrade.date.toDate ? upgrade.date.toDate() : new Date(upgrade.date)) : new Date();
                        const formattedDate = dateObj.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        });

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 text-slate-500 font-mono">{formattedDate}</td>
                            <td className="py-3 px-4 text-emerald-600 font-black">+{upgrade.seatsAdded}</td>
                            <td className="py-3 px-4 text-slate-800">{upgrade.previousLimit} → {upgrade.newLimit}</td>
                            <td className="py-3 px-4 text-slate-500">{upgrade.remainingDays} days left</td>
                            <td className="py-3 px-4 font-mono font-black text-slate-900">${upgrade.proratedFee?.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* DEVELOPER WEBHOOK SANDBOX SIMULATOR */}
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] text-start text-white space-y-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center">
            <i className="fa-solid fa-flask-vial text-lg"></i>
          </span>
          <div>
            <h3 className="font-black text-lg text-slate-100">{sT('devTitle')}</h3>
            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Secure State Engine Verification</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-4xl">
          {sT('devDesc')}
        </p>

        <div className="pt-4 border-t border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">1. Test Basic Active ($20)</p>
              <button
                type="button"
                disabled={simulatingWebhook}
                onClick={() => triggerSimulatedWebhook('BILLING.SUBSCRIPTION.ACTIVATED', 'basic')}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md disabled:opacity-50"
              >
                {simulatingWebhook ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : null}
                {sT('simSuccess')} (Basic)
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">2. Test Business Active ($1/mo/unit)</p>
              <button
                type="button"
                disabled={simulatingWebhook}
                onClick={() => triggerSimulatedWebhook('BILLING.SUBSCRIPTION.ACTIVATED', 'business')}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md disabled:opacity-50"
              >
                {simulatingWebhook ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : null}
                {sT('simSuccess')} (Business - {employeeCount || 25} units)
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">3. Test Cancel / Expiry</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={simulatingWebhook}
                  onClick={() => triggerSimulatedWebhook('BILLING.SUBSCRIPTION.CANCELLED', 'basic')}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-400 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={simulatingWebhook}
                  onClick={() => triggerSimulatedWebhook('BILLING.SUBSCRIPTION.EXPIRED', 'basic')}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  Expire
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
