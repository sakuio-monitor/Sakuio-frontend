import { createContext, useContext, useEffect } from "react";

type SetPageTitle = (title?: string) => void;

export const PageTitleContext = createContext<SetPageTitle>(() => undefined);

/** Sets the layout/page title for a dynamic route; clears it on unmount. */
export function usePageTitle(title?: string) {
  const setTitle = useContext(PageTitleContext);
  useEffect(() => {
    setTitle(title);
    return () => setTitle(undefined);
  }, [setTitle, title]);
}
