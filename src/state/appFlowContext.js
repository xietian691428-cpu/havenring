import { createContext, useContext, useMemo, useReducer } from "react";
import { appFlowReducer, initialAppFlowState } from "./appFlowMachine";

const AppFlowContext = createContext(null);

export function AppFlowProvider({ children }) {
  const [flowState, dispatchFlow] = useReducer(appFlowReducer, initialAppFlowState);
  const value = useMemo(() => ({ flowState, dispatchFlow }), [flowState]);
  return <AppFlowContext.Provider value={value}>{children}</AppFlowContext.Provider>;
}

export function useAppFlow() {
  const ctx = useContext(AppFlowContext);
  if (!ctx) {
    throw new Error("useAppFlow must be used within AppFlowProvider.");
  }
  return ctx;
}

