// @ts-nocheck
import mongoose from "mongoose";
import { connectDb } from "../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../lib/auth";
import { jsonResponse, parseJson } from "../lib/api";
import { Invoice } from "../models/invoice";
import { Load } from "../models/load";
import { Customer } from "../models/customer";
import { User } from "../models/user";
import {
  notifyUser,
  notifyAdmins,
  notifyAccounting,
  type SenderContext,
} from "../lib/notification";

function calculateInvoiceStatus(
  total: number,
  amountPaid: number,
  dueDate: Date,
  currentStatus?: string,
): string {
  if (currentStatus === "cancelled" || currentStatus === "draft") return currentStatus;
  const now = new Date();
  if (amountPaid >= total) {
    return "paid";
  }
  if (amountPaid > 0) {
    return "partially_paid";
  }
  if (dueDate < now) {
    return "overdue";
  }
  return "sent";
}

function calculateTotals(items: any[], discount = 0, taxRate = 0) {
  const subtotal = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0,
  );
  const afterDiscount = subtotal - discount;
  const taxAmount = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmount;
  return { subtotal, afterDiscount, taxAmount, total };
}

export async function invoicesHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));
  await connectDb();

  // GET: List invoices
  if (request.method === "GET") {
    const [invoices, customers, users] = await Promise.all([
      Invoice.find().sort({ createdAt: -1 }).lean().exec(),
      Customer.find().lean().exec(),
      User.find().select("_id name").lean().exec(),
    ]);

    return jsonResponse({
      invoices,
      customers,
      users,
    });
  }

  // POST: Create invoice
  if (request.method === "POST") {
    const body = await parseJson(request);
    const {
      invoiceNumber,
      customerId,
      loadIds = [],
      items = [],
      discount = 0,
      taxRate = 0,
      status = "draft",
      invoiceDate,
      dueDate,
      paymentTerms,
      referenceNumber,
      notes,
      internalNotes,
    } = body;

    // Validate required fields
    if (!customerId) throw new Error("Customer is required");
    if (!invoiceNumber) throw new Error("Invoice number is required");

    // Check for duplicate invoice number
    const existing = await Invoice.findOne({ invoiceNumber });
    if (existing) throw new Error("Invoice number already exists");

    const customer = await Customer.findById(new mongoose.Types.ObjectId(customerId));
    if (!customer) throw new Error("Customer not found");

    // Validate loads (if provided)
    if (loadIds.length > 0) {
      for (const loadId of loadIds) {
        const load = await Load.findById(new mongoose.Types.ObjectId(loadId));
        if (!load) throw new Error(`Load ${loadId} not found`);
        if (load.status === "cancelled") throw new Error(`Cannot invoice cancelled loads`);
        const existingInvoiceForLoad = await Invoice.findOne({
          loadIds: loadId,
          status: { $ne: "cancelled" },
        });
        if (existingInvoiceForLoad) {
          throw new Error(`Load ${loadId} is already invoiced`);
        }
      }
    }

    const { subtotal, taxAmount, total } = calculateTotals(items, discount, taxRate);
    const amountPaid = 0;
    const balanceDue = total - amountPaid;
    const finalStatus = calculateInvoiceStatus(total, amountPaid, new Date(dueDate), status);

    const invoice = await Invoice.create({
      invoiceNumber,
      customerId: new mongoose.Types.ObjectId(customerId),
      loadIds: loadIds.map((id) => new mongoose.Types.ObjectId(id)),
      // Snapshot customer info
      customerName: customer.companyName,
      customerEmail: customer.contactEmail,
      customerPhone: customer.contactPhone,
      customerAddress: customer.address,
      customerBillingContact: customer.contactName,
      items,
      subtotal,
      discount,
      taxRate,
      taxAmount,
      total,
      amountPaid,
      balanceDue,
      status: finalStatus,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      dueDate: new Date(dueDate),
      paymentTerms,
      referenceNumber,
      notes,
      internalNotes,
      payments: [],
      createdBy: new mongoose.Types.ObjectId(user.id),
    });

    // Mark loads as invoiced
    if (loadIds.length > 0) {
      await Load.updateMany(
        { _id: { $in: loadIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        { status: "invoiced" },
      );
    }

    // Emit invoice creation notifications
    const invSender: SenderContext = {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    };
    const invId = invoice._id.toString();
    const invActionUrl = `/invoices?focus=${invId}`;
    const invMsg = `Invoice ${invoiceNumber} for ${customer.companyName} ($${total.toFixed(2)}) has been created.`;

    void notifyAccounting(
      { title: "New invoice created", message: invMsg, notificationType: "invoice_created", relatedModule: "invoices", recordType: "Invoice", recordId: invId, actionUrl: invActionUrl, priority: "medium", metadata: { invoiceNumber, total } },
      invSender,
    );
    void notifyAdmins(
      { title: "New invoice created", message: invMsg, notificationType: "invoice_created", relatedModule: "invoices", recordType: "Invoice", recordId: invId, actionUrl: invActionUrl, priority: "low", metadata: { invoiceNumber, total } },
      invSender,
    );

    // Notify the agent who owns the customer
    if (customer.agentId) {
      void notifyUser(
        customer.agentId.toString(),
        { title: "Invoice available", message: `An invoice (${invoiceNumber}) has been generated for your customer ${customer.companyName}.`, notificationType: "invoice_available", relatedModule: "invoices", recordType: "Invoice", recordId: invId, actionUrl: invActionUrl, priority: "low", metadata: { invoiceNumber } },
        invSender,
      );
    }

    const [customers, users] = await Promise.all([
      Customer.find().lean().exec(),
      User.find().select("_id name").lean().exec(),
    ]);

    return jsonResponse({ invoice, customers, users });
  }

  // PATCH: Update invoice or add payment
  if (request.method === "PATCH") {
    const body = await parseJson(request);
    const { invoiceId, action, ...updateData } = body;

    if (!invoiceId) throw new Error("Invoice ID required");

    const invoice = await Invoice.findById(new mongoose.Types.ObjectId(invoiceId));
    if (!invoice) throw new Error("Invoice not found");

    // Handle adding a payment
    if (action === "add_payment") {
      const { paymentDate, amount, paymentMethod, referenceNumber, notes } = updateData;
      if (!paymentDate || !amount || !paymentMethod) throw new Error("Payment details required");

      const payment = {
        paymentDate: new Date(paymentDate),
        amount: Number(amount),
        paymentMethod,
        referenceNumber,
        notes,
      };

      invoice.payments.push(payment as any);
      invoice.amountPaid += Number(amount);
      invoice.balanceDue = invoice.total - invoice.amountPaid;

      if (invoice.balanceDue <= 0) {
        invoice.paidAt = new Date();
      }
      invoice.status = calculateInvoiceStatus(invoice.total, invoice.amountPaid, invoice.dueDate);

      await invoice.save();

      // Emit payment notifications if fully paid
      if (invoice.status === "paid") {
        const paySender: SenderContext = { userId: user.id, name: user.name, role: user.role, teamId: user.teamId };
        const payInvId = invoice._id.toString();
        const payUrl = `/invoices?focus=${payInvId}`;
        const payMsg = `Invoice ${invoice.invoiceNumber} has been fully paid ($${invoice.total.toFixed(2)}).`;
        void notifyAccounting({ title: "Invoice paid", message: payMsg, notificationType: "invoice_paid", relatedModule: "invoices", recordType: "Invoice", recordId: payInvId, actionUrl: payUrl, priority: "medium", metadata: { invoiceNumber: invoice.invoiceNumber } }, paySender);
        void notifyAdmins({ title: "Invoice paid", message: payMsg, notificationType: "invoice_paid", relatedModule: "invoices", recordType: "Invoice", recordId: payInvId, actionUrl: payUrl, priority: "low", metadata: { invoiceNumber: invoice.invoiceNumber } }, paySender);
        // Notify the agent who owns the customer
        try {
          const payCustomer = await Customer.findById(invoice.customerId).select("agentId companyName").lean().exec();
          if (payCustomer?.agentId) {
            void notifyUser(payCustomer.agentId.toString(), { title: "Invoice paid", message: `Invoice ${invoice.invoiceNumber} for ${payCustomer.companyName} has been fully paid.`, notificationType: "invoice_paid", relatedModule: "invoices", recordType: "Invoice", recordId: payInvId, actionUrl: payUrl, priority: "low", metadata: { invoiceNumber: invoice.invoiceNumber } }, paySender);
          }
        } catch (e) {
          console.error("[notification] invoice paid customer lookup failed:", e);
        }
      }

      const [customers, users] = await Promise.all([
        Customer.find().lean().exec(),
        User.find().select("_id name").lean().exec(),
      ]);

      return jsonResponse({ invoice, customers, users });
    }

    // Handle regular update
    const { loadIds, items, discount, taxRate } = updateData;

    // Update basic fields
    if (updateData.customerId) {
      const customer = await Customer.findById(new mongoose.Types.ObjectId(updateData.customerId));
      if (!customer) throw new Error("Customer not found");
      invoice.customerId = new mongoose.Types.ObjectId(updateData.customerId);
      invoice.customerName = customer.companyName;
      invoice.customerEmail = customer.contactEmail;
      invoice.customerPhone = customer.contactPhone;
      invoice.customerAddress = customer.address;
      invoice.customerBillingContact = customer.contactName;
    }

    if (updateData.invoiceNumber !== undefined) invoice.invoiceNumber = updateData.invoiceNumber;
    if (loadIds !== undefined)
      invoice.loadIds = loadIds.map((id) => new mongoose.Types.ObjectId(id));
    if (items !== undefined) invoice.items = items;
    if (discount !== undefined) invoice.discount = discount;
    if (taxRate !== undefined) invoice.taxRate = taxRate;

    // Recalculate totals
    const { subtotal, taxAmount, total } = calculateTotals(
      invoice.items,
      invoice.discount,
      invoice.taxRate,
    );
    invoice.subtotal = subtotal;
    invoice.taxAmount = taxAmount;
    invoice.total = total;
    invoice.balanceDue = total - invoice.amountPaid;

    if (updateData.status !== undefined) invoice.status = updateData.status;
    else
      invoice.status = calculateInvoiceStatus(
        invoice.total,
        invoice.amountPaid,
        invoice.dueDate,
        invoice.status,
      );

    if (updateData.invoiceDate !== undefined)
      invoice.invoiceDate = new Date(updateData.invoiceDate);
    if (updateData.dueDate !== undefined) invoice.dueDate = new Date(updateData.dueDate);
    if (updateData.paymentTerms !== undefined) invoice.paymentTerms = updateData.paymentTerms;
    if (updateData.referenceNumber !== undefined)
      invoice.referenceNumber = updateData.referenceNumber;
    if (updateData.notes !== undefined) invoice.notes = updateData.notes;
    if (updateData.internalNotes !== undefined) invoice.internalNotes = updateData.internalNotes;

    await invoice.save();

    const [customers, users] = await Promise.all([
      Customer.find().lean().exec(),
      User.find().select("_id name").lean().exec(),
    ]);

    return jsonResponse({ invoice, customers, users });
  }

  // DELETE: Delete invoice
  if (request.method === "DELETE") {
    const body = await parseJson(request);
    const { invoiceId } = body;

    const invoice = await Invoice.findByIdAndDelete(new mongoose.Types.ObjectId(invoiceId));
    if (!invoice) throw new Error("Invoice not found");

    // Update load statuses back if needed
    if (invoice.loadIds.length > 0) {
      await Load.updateMany({ _id: { $in: invoice.loadIds } }, { status: "delivered" });
    }

    // Emit invoice deletion notification
    const delSender: SenderContext = { userId: user.id, name: user.name, role: user.role, teamId: user.teamId };
    void notifyAdmins({ title: "Invoice deleted", message: `Invoice ${invoice.invoiceNumber} has been deleted by ${user.name}.`, notificationType: "invoice_deleted", relatedModule: "invoices", priority: "medium", metadata: { invoiceNumber: invoice.invoiceNumber } }, delSender);

    return jsonResponse({ success: true, deletedId: invoiceId });
  }

  throw new Error("Method not allowed");
}
