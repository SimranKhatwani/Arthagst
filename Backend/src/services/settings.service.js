import mongoose from 'mongoose';
import Settings from '../models/settings.model.js';
import BankAccount from '../models/bankAccount.model.js';
import { logAuditAction } from './auditLog.service.js';

/**
 * Get organization settings for the authenticated tenant (auto-creates default if not present)
 */
export const getSettings = async (tenantId) => {
  let settings = await Settings.findOne({ tenantId })
    .populate('paymentInformation.defaultBankAccountId', 'accountName accountNumber bankName ifscCode')
    .lean();

  if (!settings) {
    const created = await Settings.create({ tenantId });
    settings = created.toObject();
  }

  return settings;
};

/**
 * Update organization settings (PUT/PATCH)
 */
export const updateSettings = async (tenantId, actorUser, data) => {
  let settings = await Settings.findOne({ tenantId });

  if (!settings) {
    settings = new Settings({ tenantId });
  }

  // Cross-tenant reference check: If defaultBankAccountId is supplied, verify it belongs to this tenant
  if (data.paymentInformation?.defaultBankAccountId) {
    const bankId = data.paymentInformation.defaultBankAccountId;
    if (mongoose.isValidObjectId(bankId)) {
      const bank = await BankAccount.findOne({ _id: bankId, tenantId });
      if (!bank) {
        const error = new Error('The specified bank account was not found in your organization.');
        error.statusCode = 400;
        throw error;
      }
    } else {
      data.paymentInformation.defaultBankAccountId = null;
    }
  }

  const changes = {};

  // 1. Invoice Preferences
  if (data.invoicePreferences) {
    for (const [key, val] of Object.entries(data.invoicePreferences)) {
      if (val !== undefined) {
        settings.invoicePreferences[key] = val;
        changes[`invoicePreferences.${key}`] = val;
      }
    }
  }

  // 2. Branding
  if (data.branding) {
    if (data.branding.logoUrl !== undefined) settings.branding.logoUrl = data.branding.logoUrl;
    if (data.branding.signatureUrl !== undefined) settings.branding.signatureUrl = data.branding.signatureUrl;
    if (data.branding.primaryColor !== undefined) settings.branding.primaryColor = data.branding.primaryColor;
    if (data.branding.printDisplayPreferences) {
      for (const [key, val] of Object.entries(data.branding.printDisplayPreferences)) {
        if (val !== undefined) {
          settings.branding.printDisplayPreferences[key] = val;
        }
      }
    }
    changes.branding = data.branding;
  }

  // 3. Payment Information
  if (data.paymentInformation) {
    if (data.paymentInformation.upiId !== undefined) settings.paymentInformation.upiId = data.paymentInformation.upiId;
    if (data.paymentInformation.upiQrUrl !== undefined) settings.paymentInformation.upiQrUrl = data.paymentInformation.upiQrUrl;
    if (data.paymentInformation.defaultPaymentInstructions !== undefined) {
      settings.paymentInformation.defaultPaymentInstructions = data.paymentInformation.defaultPaymentInstructions;
    }
    if (data.paymentInformation.defaultBankAccountId !== undefined) {
      settings.paymentInformation.defaultBankAccountId = data.paymentInformation.defaultBankAccountId;
    }
    changes.paymentInformation = data.paymentInformation;
  }

  // 4. General Preferences
  if (data.generalPreferences) {
    for (const [key, val] of Object.entries(data.generalPreferences)) {
      if (val !== undefined) {
        settings.generalPreferences[key] = val;
        changes[`generalPreferences.${key}`] = val;
      }
    }
  }

  await settings.save();

  // Audit log
  logAuditAction({
    tenantId,
    actor: actorUser,
    user: actorUser,
    action: 'UPDATE',
    module: 'SETTINGS',
    entityType: 'Settings',
    entityId: settings._id,
    description: `Updated organization settings and preferences`,
    changes,
  }).catch(() => {});

  return settings.toObject();
};
