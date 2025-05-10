import { supabase } from "@/lib/supabaseClient"

// Types for notifications
export type NotificationType =
    | 'bid_placed'
    | 'bid_accepted'
    | 'payment_marked'
    | 'bid_updated'
    | 'bid_cancelled'

interface NotificationData {
    listingId?: string
    bidId?: string
    sellerId?: string
    buyerId?: string
    price?: number
    mess?: string
    meal?: string
}

/**
 * Send a notification to a user
 */
export async function sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: NotificationData = {}
) {
    try {
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                type,
                title,
                message,
                data,
            })

        if (error) throw error
        return true
    } catch (error) {
        console.error('Error sending notification:', error)
        return false
    }
}

/**
 * Helper to create notification messages for different scenarios
 */
export const notificationMessages = {
    // For a seller when a new bid is placed
    bidPlaced: (price: number, mess: string, meal: string, bidderName: string, listingDate: string) => ({
        title: 'New Bid Received',
        message: `${bidderName} placed a bid of ₹${price} on your ${mess} ${meal} for ${listingDate}.`,
    }),

    // For a buyer when their bid is accepted
    bidAccepted: (price: number, mess: string, meal: string, sellerName: string, sellerPhoneNumber: string, listingDate: string) => ({
        title: 'Bid Accepted!',
        message: `Your bid of ₹${price} for ${mess} ${meal} on ${listingDate} has been accepted. Please contact ${sellerName} at ${sellerPhoneNumber} to complete the transaction.`,
    }),

    // For a seller when they accept a bid
    bidAcceptedSeller: (price: number, mess: string, meal: string, buyerName: string, buyerPhoneNumber: string, listingDate: string) => ({
        title: 'Bid Accepted',
        message: `You've accepted ${buyerName}'s bid of ₹${price} for your ${mess} ${meal} on ${listingDate}. You can contact them at ${buyerPhoneNumber}.`,
    }),

    // For a buyer when their bid is marked as paid
    paymentMarked: (price: number, mess: string, meal: string, sellerName: string, listingDate: string) => ({
        title: 'Payment Confirmed',
        message: `Your payment of ₹${price} for ${mess} ${meal} on ${listingDate} has been confirmed by ${sellerName}.`,
    }),

    // For a seller when a buyer has paid
    paymentReceived: (price: number, mess: string, meal: string, listingDate: string) => ({
        title: 'Payment Received',
        message: `You've confirmed receiving payment of ₹${price} for your ${mess} ${meal} on ${listingDate}.`,
    }),

    // For seller when bid is updated
    bidUpdated: (price: number, mess: string, meal: string, listingDate: string) => ({
        title: 'Bid Updated',
        message: `A bid on your ${mess} ${meal} for ${listingDate} has been updated to ₹${price}.`,
    }),

    // For buyer when their accepted bid is cancelled
    bidCancelled: (price: number, mess: string, meal: string, sellerName: string, listingDate: string) => ({
        title: 'Bid Cancelled',
        message: `Your bid of ₹${price} for ${meal} at ${mess} on ${listingDate} has been cancelled by ${sellerName}. Do not make a payment.`,
    }),
}
