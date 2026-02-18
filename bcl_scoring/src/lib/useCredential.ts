import { useEffect, useState } from "react";

import { UserCredential, getStoredCredential } from "@/lib/userCredential";

const DEFAULT_CREDENTIAL: UserCredential = {
  role: "viewer",
  user_id: null,
  full_name: null,
  employee_number: null,
  auth_provider: null,
  pending_role: false,
  updated_at: "",
};

export function useCredential(): UserCredential {
  const [credential, setCredential] = useState<UserCredential>(DEFAULT_CREDENTIAL);

  useEffect(() => {
    const sync = () => {
      setCredential(getStoredCredential());
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("bim:credential-updated", sync as EventListener);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("bim:credential-updated", sync as EventListener);
    };
  }, []);

  return credential;
}
