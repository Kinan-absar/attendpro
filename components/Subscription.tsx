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
        
        const result = await dataService.verifyPayPalSubscription(subId, targetPlan, targetQty);
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
      const response = await dataService.createCheckoutSession(planId, billingCycle);
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
      const qty = planId === 'business' ? (company.employeeCount || 25) : undefined;
      const result = await dataService.simulateWebhook(eventType, mockSubId, planId, qty);
      
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
          <div className="text-start">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sT('currentPlan')}</p>
            <h2 className="text-2xl font-black text-indigo-600 uppercase tracking-tight mt-1">{plan}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest gap-1.5 ${
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
                    <div className="mt-3 text-[10px] font-black text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl block border border-emerald-100/50">
                      <i className="fa-solid fa-calculator mr-1"></i>
                      {language === 'ar'
                        ? `متوقع لمؤسستك: ${employeeCount * (billingCycle === 'annual' ? 9 : 1)} دولار / ${billingCycle === 'annual' ? 'سنة' : 'شهر'} (لـ ${employeeCount} موظفاً)`
                        : `Expected: $${employeeCount * (billingCycle === 'annual' ? 9 : 1)} / ${billingCycle === 'annual' ? 'yr' : 'mo'} (for ${employeeCount} staff)`
                      }
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
                  <div className="w-full py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest text-center shadow-inner">
                    {sT('currentActive')}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubscribe(p.id)}
                    disabled={isProcessing}
                    className={`w-full py-3 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md ${
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
