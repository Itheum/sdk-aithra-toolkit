import { Logger } from './types';

class ItheumAgentLogger implements Logger {
  constructor() {
    this.isNode =
      typeof process !== 'undefined' &&
      process.versions != null &&
      process.versions.node != null;
    this.verbose = this.isNode ? process.env.VERBOSE === 'true' : false;
  }

  private isNode: boolean;
  verbose = false;
  closeByNewLine = true;
  useIcons = true;
  private prefix = 'ITHEUM-AGENT';

  #getColor(foregroundColor = '', backgroundColor = '') {
    if (!this.isNode) {
      const colors: { [key: string]: string } = {
        black: '#000000',
        red: '#ff0000',
        green: '#00ff00',
        yellow: '#ffff00',
        blue: '#0000ff',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffffff'
      };

      const fg = colors[foregroundColor.toLowerCase()] || colors.white;
      const bg = colors[backgroundColor.toLowerCase()] || 'transparent';
      return `color: ${fg}; background: ${bg};`;
    }

    let fgc = '\x1b[37m';
    const colorMap: { [key: string]: string } = {
      black: '\x1b[30m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };

    fgc = colorMap[foregroundColor.trim().toLowerCase()] || fgc;
    let bgc = backgroundColor
      ? `\x1b[4${Object.keys(colorMap).indexOf(backgroundColor.trim().toLowerCase())}m`
      : '';

    return `${fgc}${bgc}`;
  }

  #getColorReset() {
    return this.isNode ? '\x1b[0m' : '';
  }

  #logWithStyle(
    strings: any[],
    options: {
      fg: string;
      bg: string;
      icon: string;
    }
  ) {
    const { fg, bg, icon } = options;
    const processedStrings = strings.map((item) =>
      typeof item === 'object'
        ? JSON.stringify(item, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v
          )
        : item
    );

    if (this.isNode) {
      const c = this.#getColor(fg, bg);
      console.log(
        c,
        `[${this.prefix}] ${this.useIcons ? icon + ' ' : ''}${processedStrings.join(' ')}`,
        this.#getColorReset()
      );
    } else {
      const style = this.#getColor(fg, bg);
      console.log(
        `%c[${this.prefix}] ${this.useIcons ? icon + ' ' : ''}${processedStrings.join(' ')}`,
        style
      );
    }

    if (this.closeByNewLine) console.log('');
  }

  log(...strings) {
    this.#logWithStyle(strings, {
      fg: 'white',
      bg: '',
      icon: '◎'
    });
  }

  warn(...strings) {
    this.#logWithStyle(strings, {
      fg: 'yellow',
      bg: '',
      icon: '⚠'
    });
  }

  error(...strings) {
    this.#logWithStyle(strings, {
      fg: 'red',
      bg: '',
      icon: '⛔'
    });
  }

  info(...strings) {
    this.#logWithStyle(strings, {
      fg: 'blue',
      bg: '',
      icon: 'ℹ'
    });
  }

  success(...strings) {
    this.#logWithStyle(strings, {
      fg: 'green',
      bg: '',
      icon: '✓'
    });
  }

  debug(...strings) {
    if (!this.verbose) return;
    this.#logWithStyle(strings, {
      fg: 'magenta',
      bg: '',
      icon: '⊡'
    });
  }
}

export const itheumAgentLogger = new ItheumAgentLogger();
itheumAgentLogger.closeByNewLine = true;
itheumAgentLogger.useIcons = true;

export default itheumAgentLogger;
