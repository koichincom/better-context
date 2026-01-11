import {
	createContext,
	createSignal,
	useContext,
	type Accessor,
	type Component,
	type ParentProps
} from 'solid-js';
import type { Message, InputState, CancelState, BtcaChunk } from '../types.ts';
import { services, type ChunkUpdate } from '../services.ts';
import { copyToClipboard } from '../clipboard.ts';

type MessagesState = {
	// Message history
	messages: Accessor<Message[]>;
	addSystemMessage: (content: string) => void;
	clearMessages: () => void;

	// Streaming state
	isStreaming: Accessor<boolean>;
	cancelState: Accessor<CancelState>;

	// Actions
	send: (input: InputState, allResources: string[]) => Promise<void>;
	requestCancel: () => void;
	confirmCancel: () => Promise<void>;
};

const MessagesContext = createContext<MessagesState>();

export const useMessagesContext = () => {
	const context = useContext(MessagesContext);
	if (!context) throw new Error('useMessagesContext must be used within MessagesProvider');
	return context;
};

const defaultMessageHistory: Message[] = [
	{
		role: 'system',
		content:
			"Welcome to btca! Ask anything about the library/framework you're interested in (make sure you @ it first)"
	}
];

export const MessagesProvider: Component<ParentProps> = (props) => {
	const [messages, setMessages] = createSignal<Message[]>(defaultMessageHistory);
	const [isStreaming, setIsStreaming] = createSignal(false);
	const [cancelState, setCancelState] = createSignal<CancelState>('none');

	// Internal helpers for message updates
	const addMessage = (message: Message) => setMessages((prev) => [...prev, message]);

	const addChunkToLastAssistant = (chunk: BtcaChunk) => {
		setMessages((prev) => {
			const newHistory = [...prev];
			for (let i = newHistory.length - 1; i >= 0; i--) {
				const msg = newHistory[i];
				if (msg?.role === 'assistant' && msg.content.type === 'chunks') {
					newHistory[i] = {
						role: 'assistant',
						content: { type: 'chunks', chunks: [...msg.content.chunks, chunk] }
					};
					break;
				}
			}
			return newHistory;
		});
	};

	const updateChunkInLastAssistant = (id: string, updates: Partial<BtcaChunk>) => {
		setMessages((prev) => {
			const newHistory = [...prev];
			for (let i = newHistory.length - 1; i >= 0; i--) {
				const msg = newHistory[i];
				if (msg?.role === 'assistant' && msg.content.type === 'chunks') {
					const updatedChunks = msg.content.chunks.map((c): BtcaChunk => {
						if (c.id !== id) return c;
						if (c.type === 'text' && 'text' in updates) {
							return { ...c, text: updates.text as string };
						}
						if (c.type === 'reasoning' && 'text' in updates) {
							return { ...c, text: updates.text as string };
						}
						if (c.type === 'tool' && 'state' in updates) {
							return { ...c, state: updates.state as 'pending' | 'running' | 'completed' };
						}
						return c;
					});
					newHistory[i] = {
						role: 'assistant',
						content: { type: 'chunks', chunks: updatedChunks }
					};
					break;
				}
			}
			return newHistory;
		});
	};

	const markLastAssistantMessageCanceled = () => {
		setMessages((prev) => {
			const newHistory = [...prev];
			for (let i = newHistory.length - 1; i >= 0; i--) {
				const msg = newHistory[i];
				if (msg?.role === 'assistant') {
					newHistory[i] = { ...msg, canceled: true };
					break;
				}
			}
			return newHistory;
		});
	};

	const handleChunkUpdate = (update: ChunkUpdate) => {
		if (update.type === 'add') {
			addChunkToLastAssistant(update.chunk);
		} else {
			updateChunkInLastAssistant(update.id, update.chunk);
		}
	};

	// Main send method
	const send = async (input: InputState, allResources: string[]) => {
		const question = input
			.map((s) => s.content)
			.join('')
			.replace(/@\w+/g, '')
			.trim()
			.replace(/\s+/g, ' ');

		// Add user message
		addMessage({ role: 'user', content: input });

		// Add placeholder assistant message
		addMessage({ role: 'assistant', content: { type: 'chunks', chunks: [] } });

		setIsStreaming(true);
		setCancelState('none');

		try {
			const finalChunks = await services.askQuestion(allResources, question, handleChunkUpdate);

			// Check if canceled during streaming
			if (cancelState() === 'pending') return;

			const textChunks = finalChunks.filter((c) => c.type === 'text');
			const fullResponse = textChunks.map((c) => c.text).join('\n\n');

			if (fullResponse) {
				await copyToClipboard(fullResponse);
				addMessage({ role: 'system', content: 'Answer copied to clipboard!' });
			}
		} catch (error) {
			if (cancelState() !== 'pending') {
				addMessage({ role: 'system', content: `Error: ${error}` });
			}
		} finally {
			setIsStreaming(false);
			setCancelState('none');
		}
	};

	const requestCancel = () => {
		if (cancelState() === 'none') {
			setCancelState('pending');
		}
	};

	const confirmCancel = async () => {
		await services.cancelCurrentRequest();
		markLastAssistantMessageCanceled();
		addMessage({ role: 'system', content: 'Request canceled.' });
		setIsStreaming(false);
		setCancelState('none');
	};

	const state: MessagesState = {
		messages,
		addSystemMessage: (content) => addMessage({ role: 'system', content }),
		clearMessages: () => setMessages(defaultMessageHistory),
		isStreaming,
		cancelState,
		send,
		requestCancel,
		confirmCancel
	};

	return <MessagesContext.Provider value={state}>{props.children}</MessagesContext.Provider>;
};
