import {
	createContext,
	createSignal,
	useContext,
	type Accessor,
	type Component,
	type ParentProps
} from 'solid-js';

type ToastState = {
	message: Accessor<string | null>;
	show: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastState>();

export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) throw new Error('useToast must be used within ToastProvider');
	return context;
};

export const ToastProvider: Component<ParentProps> = (props) => {
	const [message, setMessage] = createSignal<string | null>(null);
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const show = (msg: string, durationMs = 1500) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		setMessage(msg);
		timeoutId = setTimeout(() => {
			setMessage(null);
			timeoutId = null;
		}, durationMs);
	};

	return <ToastContext.Provider value={{ message, show }}>{props.children}</ToastContext.Provider>;
};
