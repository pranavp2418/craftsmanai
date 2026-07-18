import { configureStore, combineReducers } from '@reduxjs/toolkit';
import exampleReducer from './slices/exampleSlice';

// Admin Imports
import adminDashboardReducer from './slices/admin/dashboard/adminDashboardSlice';
import adminRequestsOverTimeReducer from './slices/admin/dashboard/adminRequestsOverTimeSlice';
import adminStatusDistributionReducer from './slices/admin/dashboard/adminStatusDistributionSlice';
import adminRetailersReducer from './slices/admin/retailers/adminRetailersSlice';
import adminRetailerInfoReducer from './slices/admin/retailers/adminRetailerInfoSlice';
import adminCreateRetailerReducer from './slices/admin/retailers/adminCreateRetailerSlice';
import adminCustomersKpiReducer from './slices/admin/customers/adminCustomersKpiSlice';
import adminCustomersListReducer from './slices/admin/customers/adminCustomersListSlice';
import adminCustomerDetailReducer from './slices/admin/customers/adminCustomerDetailSlice';
import adminManufacturersReducer from './slices/admin/manufacturers/adminManufacturersSlice';
import adminManufacturerDetailReducer from './slices/admin/manufacturers/adminManufacturerDetailSlice';
import adminManufacturerDisableReducer from './slices/admin/manufacturers/adminManufacturerDisableSlice';
import adminManufacturerEnableReducer from './slices/admin/manufacturers/adminManufacturerEnableSlice';
import adminManufacturersSummaryReducer from './slices/admin/manufacturers/adminManufacturersSummarySlice';
import adminQuizTypesReducer from './slices/admin/quiz/adminQuizTypesSlice';
import adminQuizSubtypesReducer from './slices/admin/quiz/adminQuizSubtypesSlice';
import adminQuizQuestionsReducer from './slices/admin/quiz/adminQuizQuestionsSlice';
import adminQuizToggleStatusReducer from './slices/admin/quiz/adminQuizToggleStatusSlice';
import adminQuizEditQuestionReducer from './slices/admin/quiz/adminQuizEditQuestionSlice';
import adminQuizAddQuestionReducer from './slices/admin/quiz/adminQuizAddQuestionSlice';
import adminSysActivityReducer from './slices/admin/dashboard/adminSysActivitySlice';
import adminRequestStatusReducer from './slices/admin/dashboard/adminRequestStatusSlice';
import adminJewelleryTypesReducer from './slices/admin/jewellery/adminJewelleryTypesSlice';
import adminJewelleryTypeCreateReducer from './slices/admin/jewellery/adminJewelleryTypeCreateSlice';
import adminJewelleryTypeEditReducer from './slices/admin/jewellery/adminJewelleryTypeEditSlice';
import adminJewelleryTypeStatusReducer from './slices/admin/jewellery/adminJewelleryTypeStatusSlice';
import adminJewellerySubtypeCreateReducer from './slices/admin/jewellery/adminJewellerySubtypeCreateSlice';
import adminJewelleryTypeDeleteReducer from './slices/admin/jewellery/adminJewelleryTypeDeleteSlice';
import adminJewellerySubtypesReducer from './slices/admin/jewellery/adminJewellerySubtypesSlice';
import adminJewellerySubtypeStatusReducer from './slices/admin/jewellery/adminJewellerySubtypeStatusSlice';
import adminJewellerySubtypeEditReducer from './slices/admin/jewellery/adminJewellerySubtypeEditSlice';
import adminCreatePlanReducer from './slices/admin/subscriptions/adminCreatePlanSlice';
import adminPlansReducer from './slices/admin/subscriptions/adminPlansSlice';
import adminUpdatePlanReducer from './slices/admin/subscriptions/adminUpdatePlanSlice';
import adminTopUpPacksReducer from './slices/admin/subscriptions/adminTopUpPacksSlice';
import adminSubscriptionStatsReducer from './slices/admin/subscriptions/adminSubscriptionStatsSlice';
import adminRevenueGrowthReducer from './slices/admin/subscriptions/adminRevenueGrowthSlice';
import adminSubscriptionGrowthReducer from './slices/admin/subscriptions/adminSubscriptionGrowthSlice';
import adminPlanDistributionReducer from './slices/admin/subscriptions/adminPlanDistributionSlice';
import adminUsageInsightsReducer from './slices/admin/subscriptions/adminUsageInsightsSlice';
import adminTopDesignersReducer from './slices/admin/subscriptions/adminTopDesignersSlice';
import adminActiveTopupsReducer from './slices/admin/subscriptions/adminActiveTopupsSlice';
import adminActiveTopupDetailsReducer from './slices/admin/subscriptions/adminActiveTopupDetailsSlice';
import adminQuestionKeysReducer from './slices/admin/quiz/adminQuestionKeysSlice';
import adminCreateQuestionKeyReducer from './slices/admin/quiz/adminCreateQuestionKeySlice';
import adminUserSubscriptionsReducer from './slices/admin/subscriptions/adminUserSubscriptionsSlice';
import adminPaymentHistoryReducer from './slices/admin/subscriptions/adminPaymentHistorySlice';
import adminCancellationSummaryReducer from './slices/admin/subscriptions/adminCancellationSummarySlice';
import adminCancellationReasonsReducer from './slices/admin/subscriptions/adminCancellationReasonsSlice';
import adminCancellationTrendsReducer from './slices/admin/subscriptions/adminCancellationTrendsSlice';
import adminCancellationRecordsReducer from './slices/admin/subscriptions/adminCancellationRecordsSlice';
import adminSubscriptionActivityLogsReducer from './slices/admin/subscriptions/adminSubscriptionActivityLogsSlice';
import adminPaymentDetailsReducer from './slices/admin/subscriptions/adminPaymentDetailsSlice';
import adminExportPaymentHistoryReducer from './slices/admin/subscriptions/adminExportPaymentHistorySlice';
import adminSettingsReducer from './slices/admin/settings/adminSettingsSlice';
import adminSettingsLogsReducer from './slices/admin/settings/adminSettingsLogsSlice';
import adminUpdateSettingsReducer from './slices/admin/settings/adminUpdateSettingsSlice';
import adminDownloadPaymentRecordCSVReducer from './slices/admin/subscriptions/adminDownloadPaymentRecordCSVSlice';

// Auth imports
import loginReducer from './slices/login/loginSlice';
import signupReducer from './slices/signup/signupSlice';
import resendOtpReducer from './slices/signup/resendOtpSlice';
import resetRequestReducer from './slices/forgotPassword/resetRequestSlice';
import otpVerifyReducer from './slices/forgotPassword/otpVerify';
import resetPasswordReducer from './slices/forgotPassword/resetPasswordSlice';
import logoutReducer from './slices/logout/logoutSlice';
import createDesignReducer from './slices/retailer/createDesignSlice';
import designsReducer from './slices/retailer/designsSlice';
import designDetailReducer from './slices/retailer/designDetailSlice';
import designVariantAnglesReducer from './slices/retailer/designVariantAnglesSlice';
import designVariantMetalsReducer from './slices/retailer/designVariantMetalsSlice';
import designVariantRefineReducer from './slices/retailer/designVariantRefineSlice';
import designVariantReducer from './slices/retailer/designVariantSlice';
import designVariantShareReducer from './slices/retailer/designVariantShareSlice';
import designVariantSharesReducer from './slices/retailer/designVariantSharesSlice';
import designVariantApproveReducer from './slices/retailer/designVariantApproveSlice';
import designVariantRejectReducer from './slices/retailer/designVariantRejectSlice';
import designVariantShareMfgReducer from './slices/retailer/designVariantShareMfgSlice';
import authReducer from './slices/auth/authSlice';
import retailerCustomerReducer from './slices/retailer/customerSlice';
import retailerManufacturerReducer from './slices/retailer/manufacturerSlice';
import retailerProfileReducer from './slices/retailer/settings/profileSlice';
import retailerNotificationReducer from './slices/retailer/settings/notificationSlice';
import retailerBrandReducer from './slices/retailer/settings/brandSlice';
import retailerAppearanceReducer from './slices/retailer/settings/appearanceSlice';
import retailerMyPlanReducer from './slices/retailer/billing/myPlanSlice';
import retailerSubscriptionsReducer from './slices/retailer/billing/subscriptionsSlice';
import retailerTokenStatusReducer from './slices/retailer/billing/tokenStatusSlice';
import retailerPaymentHistoryReducer from './slices/retailer/billing/paymentHistorySlice';
import retailerCheckoutReducer from './slices/retailer/billing/checkoutSlice';
import retailerTopUpCheckoutReducer from './slices/retailer/billing/topUpCheckoutSlice';
import retailerVerifyPaymentReducer from './slices/retailer/billing/verifyPaymentSlice';
import retailerInvoicesReducer from './slices/retailer/billing/invoicesSlice';
import retailerInvoiceDownloadReducer from './slices/retailer/billing/invoiceDownloadSlice';
import retailerCancelSubscriptionReducer from './slices/retailer/billing/cancelSubscriptionSlice';
import retailerCancelPlanReducer from './slices/retailer/billing/cancelPlanSlice';
import retailerCancelPlansReducer from './slices/retailer/billing/cancelPlansSlice';
import retailerTopupPacksReducer from './slices/retailer/billing/topupPacksSlice';
import retailerChangePasswordReducer from './slices/retailer/settings/changePasswordSlice';
import retailerToggle2FAReducer from './slices/retailer/settings/toggle2faSlice';
import customerAccessReducer from './slices/customer/customerSlice';
import manufacturerAccessReducer from './slices/manufacturer/manufacturerSlice';
import retailerSessionsReducer from './slices/retailer/settings/sessionsSlice';
import retailerDesignCompleteReducer from './slices/retailer/designCompleteSlice';
import retailerDesignDownloadRenderReducer from './slices/retailer/designDownloadRenderSlice';
import retailerDesignArchiveReducer from './slices/retailer/designArchiveSlice';
import retailerDesignDeleteReducer from './slices/retailer/designDeleteSlice';
import retailerDesignVariantArchiveReducer from './slices/retailer/designVariantArchiveSlice';
import retailerDesignVariantDeleteReducer from './slices/retailer/designVariantDeleteSlice';
import retailerAnalyticsArchivedReducer from './slices/retailer/analytics/archivedSlice';
import retailerAnalyticsArchivedVersionsReducer from './slices/retailer/analytics/archivedVersionsSlice';
import retailerDesignVariantRestoreReducer from './slices/retailer/analytics/designVariantRestoreSlice';
import retailerDesignRestoreReducer from './slices/retailer/analytics/designRestoreSlice';
import productionSheetReducer from './slices/productionSheet/productionSheetSlice';
import retailerAnalyticsMetricsReducer from './slices/retailer/analytics/metricsSlice';
import retailerAnalyticsDesignTimeReducer from './slices/retailer/analytics/designTimeSlice';
import retailerAnalyticsCompletedOrdersReducer from './slices/retailer/analytics/completedOrdersSlice';
import retailerAnalyticsConversionFunnelReducer from './slices/retailer/analytics/conversionFunnelSlice';
import retailerAnalyticsJewelleryBreakdownReducer from './slices/retailer/analytics/jewelleryBreakdownSlice';
import retailerAnalyticsActivityLogReducer from './slices/retailer/analytics/activityLogSlice';
import retailerDesignVariantManufacturerSharesReducer from './slices/retailer/designVariantManufacturerSharesSlice';
import retailerQuoteApproveReducer from './slices/retailer/quoteApproveSlice';
import retailerQuoteRejectReducer from './slices/retailer/quoteRejectSlice';
import retailerDesignVariantResendMfgReducer from './slices/retailer/designVariantResendMfgSlice';
import retailerContactReducer from './slices/retailer/contactSlice';

// Import other reducers here
import notificationsReducer from './slices/notifications/notificationsSlice';

const appReducer = combineReducers({
    productionSheet: productionSheetReducer,
    example: exampleReducer,
    adminDashboard: adminDashboardReducer,
    adminRequestsOverTime: adminRequestsOverTimeReducer,
    adminStatusDistribution: adminStatusDistributionReducer,
    adminRetailers: adminRetailersReducer,
    adminRetailerInfo: adminRetailerInfoReducer,
    adminCreateRetailer: adminCreateRetailerReducer,
    adminCustomersKpi: adminCustomersKpiReducer,
    adminCustomersList: adminCustomersListReducer,
    adminCustomerDetail: adminCustomerDetailReducer,
    adminManufacturers: adminManufacturersReducer,
    adminManufacturerDetail: adminManufacturerDetailReducer,
    adminManufacturerDisable: adminManufacturerDisableReducer,
    adminManufacturerEnable: adminManufacturerEnableReducer,
    adminManufacturersSummary: adminManufacturersSummaryReducer,
    adminQuizTypes: adminQuizTypesReducer,
    adminQuizSubtypes: adminQuizSubtypesReducer,
    adminQuizQuestions: adminQuizQuestionsReducer,
    adminQuizToggleStatus: adminQuizToggleStatusReducer,
    adminQuizEditQuestion: adminQuizEditQuestionReducer,
    adminQuizAddQuestion: adminQuizAddQuestionReducer,
    adminSysActivity: adminSysActivityReducer,
    adminRequestStatus: adminRequestStatusReducer,
    adminJewelleryTypes: adminJewelleryTypesReducer,
    adminJewelleryTypeCreate: adminJewelleryTypeCreateReducer,
    adminJewelleryTypeEdit: adminJewelleryTypeEditReducer,
    adminJewelleryTypeStatus: adminJewelleryTypeStatusReducer,
    adminJewellerySubtypeCreate: adminJewellerySubtypeCreateReducer,
    adminJewelleryTypeDelete: adminJewelleryTypeDeleteReducer,
    adminJewellerySubtypes: adminJewellerySubtypesReducer,
    adminJewellerySubtypeStatus: adminJewellerySubtypeStatusReducer,
    adminJewellerySubtypeEdit: adminJewellerySubtypeEditReducer,
    adminCreatePlan: adminCreatePlanReducer,
    adminPlans: adminPlansReducer,
    adminUpdatePlan: adminUpdatePlanReducer,
    adminTopUpPacks: adminTopUpPacksReducer,
    adminSubscriptionStats: adminSubscriptionStatsReducer,
    adminRevenueGrowth: adminRevenueGrowthReducer,
    adminSubscriptionGrowth: adminSubscriptionGrowthReducer,
    adminPlanDistribution: adminPlanDistributionReducer,
    adminUsageInsights: adminUsageInsightsReducer,
    adminTopDesigners: adminTopDesignersReducer,
    adminActiveTopups: adminActiveTopupsReducer,
    adminActiveTopupDetails: adminActiveTopupDetailsReducer,
    adminQuestionKeys: adminQuestionKeysReducer,
    adminCreateQuestionKey: adminCreateQuestionKeyReducer,
    adminUserSubscriptions: adminUserSubscriptionsReducer,
    adminPaymentHistory: adminPaymentHistoryReducer,
    adminCancellationSummary: adminCancellationSummaryReducer,
    adminCancellationReasons: adminCancellationReasonsReducer,
    adminCancellationTrends: adminCancellationTrendsReducer,
    adminCancellationRecords: adminCancellationRecordsReducer,
    adminSubscriptionActivityLogs: adminSubscriptionActivityLogsReducer,
    adminPaymentDetails: adminPaymentDetailsReducer,
    adminExportPaymentHistory: adminExportPaymentHistoryReducer,
    adminSettings: adminSettingsReducer,
    adminSettingsLogs: adminSettingsLogsReducer,
    adminUpdateSettings: adminUpdateSettingsReducer,
    adminDownloadPaymentRecordCSV: adminDownloadPaymentRecordCSVReducer,
    login: loginReducer,
    signup: signupReducer,
    resendOtp: resendOtpReducer,
    resetRequest: resetRequestReducer,
    otpVerify: otpVerifyReducer,
    resetPassword: resetPasswordReducer,
    logout: logoutReducer,
    retailerCreateDesign: createDesignReducer,
    retailerDesigns: designsReducer,
    retailerDesignDetail: designDetailReducer,
    retailerDesignVariantAngles: designVariantAnglesReducer,
    retailerDesignVariantMetals: designVariantMetalsReducer,
    retailerDesignVariantRefine: designVariantRefineReducer,
    retailerDesignVariant: designVariantReducer,
    retailerDesignVariantShare: designVariantShareReducer,
    retailerDesignVariantShares: designVariantSharesReducer,
    retailerDesignVariantApprove: designVariantApproveReducer,
    retailerDesignVariantReject: designVariantRejectReducer,
    retailerDesignVariantShareMfg: designVariantShareMfgReducer,
    retailerCustomer: retailerCustomerReducer,
    retailerManufacturer: retailerManufacturerReducer,
    retailerProfile: retailerProfileReducer,
    retailerNotification: retailerNotificationReducer,
    retailerBrand: retailerBrandReducer,
    retailerAppearance: retailerAppearanceReducer,
    retailerMyPlan: retailerMyPlanReducer,
    retailerSubscriptions: retailerSubscriptionsReducer,
    retailerTokenStatus: retailerTokenStatusReducer,
    retailerPaymentHistory: retailerPaymentHistoryReducer,
    retailerCheckout: retailerCheckoutReducer,
    retailerTopUpCheckout: retailerTopUpCheckoutReducer,
    retailerVerifyPayment: retailerVerifyPaymentReducer,
    retailerInvoices: retailerInvoicesReducer,
    retailerInvoiceDownload: retailerInvoiceDownloadReducer,
    retailerCancelSubscription: retailerCancelSubscriptionReducer,
    retailerCancelPlan: retailerCancelPlanReducer,
    retailerCancelPlans: retailerCancelPlansReducer,
    retailerTopupPacks: retailerTopupPacksReducer,
    retailerChangePassword: retailerChangePasswordReducer,
    retailerToggle2FA: retailerToggle2FAReducer,
    retailerSessions: retailerSessionsReducer,
    retailerDesignComplete: retailerDesignCompleteReducer,
    retailerDesignDownloadRender: retailerDesignDownloadRenderReducer,
    retailerDesignArchive: retailerDesignArchiveReducer,
    retailerDesignDelete: retailerDesignDeleteReducer,
    retailerDesignVariantArchive: retailerDesignVariantArchiveReducer,
    retailerDesignVariantDelete: retailerDesignVariantDeleteReducer,
    retailerAnalyticsArchived: retailerAnalyticsArchivedReducer,
    retailerAnalyticsArchivedVersions: retailerAnalyticsArchivedVersionsReducer,
    retailerDesignVariantRestore: retailerDesignVariantRestoreReducer,
    retailerDesignRestore: retailerDesignRestoreReducer,
    retailerAnalyticsMetrics: retailerAnalyticsMetricsReducer,
    retailerAnalyticsDesignTime: retailerAnalyticsDesignTimeReducer,
    retailerAnalyticsCompletedOrders: retailerAnalyticsCompletedOrdersReducer,
    retailerAnalyticsConversionFunnel: retailerAnalyticsConversionFunnelReducer,
    retailerAnalyticsJewelleryBreakdown: retailerAnalyticsJewelleryBreakdownReducer,
    retailerAnalyticsActivityLog: retailerAnalyticsActivityLogReducer,
    retailerDesignVariantManufacturerShares: retailerDesignVariantManufacturerSharesReducer,
    auth: authReducer,
    notifications: notificationsReducer,
    customerAccess: customerAccessReducer,
    manufacturerAccess: manufacturerAccessReducer,
    retailerQuoteApprove: retailerQuoteApproveReducer,
    retailerQuoteReject: retailerQuoteRejectReducer,
    retailerDesignVariantResendMfg: retailerDesignVariantResendMfgReducer,
    retailerContact: retailerContactReducer,
});

const rootReducer = (state: any, action: any) => {
  if (
    action.type === 'auth/clearAuth' ||
    action.type === 'login/logout' ||
    action.type === 'logout/logoutUser/fulfilled' ||
    action.type === 'login/loginUser/fulfilled'
  ) {
    state = undefined;
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
