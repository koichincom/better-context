import { colors } from './theme.ts';
import { Messages } from './components/messages.tsx';
import { Show, type Accessor, type Component } from 'solid-js';
import { Header } from './components/header.tsx';
import { InputSection } from './components/input-section.tsx';
import { useToast } from './context/toast-context.tsx';

const WarningBanner: Component = () => {
	return (
		<box
			style={{
				height: 1,
				width: '100%',
				backgroundColor: colors.error,
				flexDirection: 'row',
				justifyContent: 'center',
				alignItems: 'center'
			}}
		>
			<text fg={colors.bg}>
				{' WARNING: This software is under active development and may contain bugs '}
			</text>
		</box>
	);
};

const Toast: Component = () => {
	const toast = useToast();

	return (
		<Show when={toast.message()}>
			<box
				style={{
					position: 'absolute',
					top: 3,
					right: 2,
					backgroundColor: colors.bg,
					border: true,
					borderColor: colors.accent,
					padding: 1,
					paddingLeft: 2,
					paddingRight: 2
				}}
			>
				<text fg={colors.text}>{toast.message()}</text>
			</box>
		</Show>
	);
};

export const MainUi: Component<{
	heightPercent: Accessor<`${number}%`>;
}> = (props) => {
	return (
		<box
			width="100%"
			height={props.heightPercent()}
			style={{
				flexDirection: 'column',
				backgroundColor: colors.bg
			}}
		>
			<WarningBanner />
			<Header />
			<Messages />
			<InputSection />
			<Toast />
		</box>
	);
};
