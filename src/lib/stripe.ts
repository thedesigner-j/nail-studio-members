import Stripe from "stripe";

// Lazy singleton, not instantiated at module load: Next.js evaluates route
// modules (including anything that imports this) during the build itself,
// so eagerly constructing Stripe here would fail the build whenever
// STRIPE_SECRET_KEY isn't set yet, even on routes that never touch Stripe
// at runtime. Deferring construction until first real use means a missing
// key only fails when a deposit is actually attempted, not at build time.
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}
