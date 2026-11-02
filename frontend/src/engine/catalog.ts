import data from "../generated/catalog.json";
import type { Catalog } from "./types";

/** Catalogue embarqué dans l'application (généré depuis catalog/*.yaml par `make generate`). */
export const CATALOG = data as unknown as Catalog;
