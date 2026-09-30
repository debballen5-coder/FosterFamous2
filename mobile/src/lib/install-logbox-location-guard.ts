type SourceLocation = {
  row: number;
  column: number;
};

type StackFrame = {
  fileName?: string | null;
  location?: SourceLocation | null;
  [key: string]: unknown;
};

type CodeFrame = {
  location?: SourceLocation | null;
  [key: string]: unknown;
};

type LogBoxLogInstance = {
  codeFrame?: CodeFrame | null;
  componentCodeFrame?: CodeFrame | null;
};

type LogBoxLogPrototype = {
  handleSymbolicateAsync: (this: LogBoxLogInstance) => Promise<void>;
  getAvailableStack: (this: LogBoxLogInstance) => StackFrame[];
  getAvailableComponentStack: (this: LogBoxLogInstance) => StackFrame[];
  __fosterFamousLocationGuardInstalled?: boolean;
};

const UNKNOWN_LOCATION: SourceLocation = { row: 1, column: 0 };

function withSafeLocation(frame: StackFrame): StackFrame {
  if (!frame.fileName || frame.location) return frame;
  return { ...frame, location: UNKNOWN_LOCATION };
}

function withSafeCodeFrameLocation(frame: CodeFrame | null | undefined): CodeFrame | null | undefined {
  return frame && !frame.location ? { ...frame, location: UNKNOWN_LOCATION } : frame;
}

/**
 * Vibecode's React Native development patch formats symbolicated locations
 * without accounting for React Native's documented nullable `location` field.
 * Normalize those development-only records before the reporter reads them.
 */
export function installLogBoxLocationGuard(): void {
  if (!__DEV__) return;

  // React Native exposes this internal module through its package wildcard.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('react-native/Libraries/LogBox/Data/LogBoxLog') as {
    default?: { prototype: LogBoxLogPrototype };
  };
  const prototype = module.default?.prototype;
  if (!prototype || prototype.__fosterFamousLocationGuardInstalled) return;

  const originalHandleSymbolicateAsync = prototype.handleSymbolicateAsync;
  const originalGetAvailableStack = prototype.getAvailableStack;
  const originalGetAvailableComponentStack = prototype.getAvailableComponentStack;

  prototype.handleSymbolicateAsync = async function handleSymbolicateAsyncWithSafeLocations() {
    try {
      await originalHandleSymbolicateAsync.call(this);
    } catch {
      // Reporting the original app error is more important than symbolication.
    }
    this.codeFrame = withSafeCodeFrameLocation(this.codeFrame);
    this.componentCodeFrame = withSafeCodeFrameLocation(this.componentCodeFrame);
  };
  prototype.getAvailableStack = function getAvailableStackWithSafeLocations() {
    const stack = originalGetAvailableStack.call(this);
    return Array.isArray(stack) ? stack.map(withSafeLocation) : [];
  };
  prototype.getAvailableComponentStack = function getAvailableComponentStackWithSafeLocations() {
    const stack = originalGetAvailableComponentStack.call(this);
    return Array.isArray(stack) ? stack.map(withSafeLocation) : [];
  };
  prototype.__fosterFamousLocationGuardInstalled = true;
}
