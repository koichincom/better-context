import type { Component } from 'solid-js';
import { colors } from '../theme.ts';
import type { CancelState } from '../types.ts';

const VERSION = '0.7.0';

export interface StatusBarProps {
	cursorIn: string;
	isStreaming: boolean;
	cancelState: CancelState;
}

export const StatusBar: Component<StatusBarProps> = (props) => {
	const getHelpText = () => {
		if (props.isStreaming) {
			if (props.cancelState === 'pending') {
				return ' Press [Esc] again to confirm cancel';
			}
			return ' Streaming... [Esc] to cancel';
		}

		if (props.cursorIn === 'command') {
			return ' [Up/Down] Navigate  [Enter] Select  [Esc] Cancel';
		}

		if (props.cursorIn === 'mention') {
			return ' [Up/Down] Navigate  [Tab/Enter] Select  [Esc] Cancel';
		}

		return ' [@repo] Ask question  [/] Commands  [Ctrl+Q] Quit';
	};

	return (
		<box
			style={{
				height: 1,
				width: '100%',
				backgroundColor: colors.bgMuted,
				flexDirection: 'row',
				justifyContent: 'space-between',
				paddingLeft: 1,
				paddingRight: 1
			}}
		>
			<text fg={colors.textSubtle} content={getHelpText()} />
			<text fg={colors.textSubtle} content={`v${VERSION}`} />
		</box>
	);
};
