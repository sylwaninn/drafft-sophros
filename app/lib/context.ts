import { createContext } from "react-router";
import type { Staff } from "./roles";

/** The signed-in staff member, set by the root middleware for every loader and action. */
export const staffContext = createContext<Staff>();
