const express = require("express");
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();

// Use raw body parser for Stripe webhook verification
app.use(bodyParser.raw({ type: "application/json" }));

// Endpoint to handle Stripe webhooks
app.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
      // Define and call a method to handle the successful payment intent
      // handlePaymentIntentSucceeded(paymentIntent);
      break;
    case "payment_method.attached":
      const paymentMethod = event.data.object;
      // Define and call a method to handle the successful attachment of a PaymentMethod
      // handlePaymentMethodAttached(paymentMethod);
      break;
    case "checkout.session.completed":
      const session = event.data.object;
      await handleCheckoutSession(session);
      break;
    default:
      console.log(`Unhandled event type ${event.type}.`);
  }

  res.send();
});

// Function to handle successful checkout session
const handleCheckoutSession = async (session) => {
  try {
    const docRef = db.collection("checkout_sessions").doc(session.id);
    await docRef.set({
      id: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      customer: session.customer_details.email,
      payment_status: session.payment_status,
      created: new Date(session.created * 1000), // Convert from Unix timestamp to JS Date
    });
    console.log("Checkout session stored in Firestore:", session.id);
  } catch (error) {
    console.error("Error storing session in Firestore:", error);
  }
};

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));