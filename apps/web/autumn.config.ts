import { feature, product, featureItem, priceItem } from 'atmn';

// Features
export const sandboxHours = feature({
	id: 'sandbox_hours',
	name: 'Sandbox Hours',
	type: 'single_use'
});

export const tokensOut = feature({
	id: 'tokens_out',
	name: 'Tokens Out',
	type: 'single_use'
});

export const tokensIn = feature({
	id: 'tokens_in',
	name: 'Tokens In',
	type: 'single_use'
});

export const chatMessages = feature({
	id: 'chat_messages',
	name: 'Chat Messages',
	type: 'single_use'
});

// Products
export const freePlan = product({
	id: 'free_plan',
	name: 'Free Plan',
	is_default: true,
	items: [
		featureItem({
			feature_id: chatMessages.id,
			included_usage: 5
		})
	]
});

export const btcaPro = product({
	id: 'btca_pro',
	name: 'Pro Plan',
	items: [
		priceItem({
			price: 8,
			interval: 'month'
		}),

		featureItem({
			feature_id: sandboxHours.id,
			included_usage: 6,
			interval: 'month'
		}),

		featureItem({
			feature_id: tokensIn.id,
			included_usage: 1500000,
			interval: 'month'
		}),

		featureItem({
			feature_id: tokensOut.id,
			included_usage: 300000,
			interval: 'month'
		})
	]
});
