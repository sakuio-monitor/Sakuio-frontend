import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  joinRemotePath,
  normalizeRemotePath,
  remoteBasename,
  remoteDirname,
} from "./fileManagerApi";

export interface RemoteUploadProgress {
  id: string;
  name: string;
  destination: string;
  value: number;
  speed?: number;
  size?: number;
  uploadedBytes?: number;
}

export interface RemoteUploadOptions {
  silent?: boolean;
}

const createUploadTaskID = () => `upload-${crypto.randomUUID()}`;

export const useRemoteFileUpload = (
  uuid: string | null,
  onComplete: (destination: string) => void,
  options: RemoteUploadOptions = {},
) => {
  const { t } = useTranslation();
  const [uploadProgress, setUploadProgress] = useState<RemoteUploadProgress[]>([]);
  const abortControllersRef = useRef(new Map<string, AbortController>());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const removeProgress = useCallback((id: string) => {
    setUploadProgress((current) => current.filter((item) => item.id !== id));
  }, []);

  const uploadOne = useCallback(
    async (file: Blob, destination: string, name: string, uploadOptions: RemoteUploadOptions = options) => {
      if (!uuid) return false;
      const targetPath = joinRemotePath(normalizeRemotePath(destination), name);
      const taskID = createUploadTaskID();
      const controller = new AbortController();
      abortControllersRef.current.set(taskID, controller);
      setUploadProgress((current) => [
        ...current,
        {
          id: taskID,
          name,
          destination: targetPath,
          value: 0,
          size: file.size,
          uploadedBytes: 0,
        },
      ]);

      try {
        const qs = new URLSearchParams({ path: targetPath });
        const res = await fetch(`/api/admin/nodes/${encodeURIComponent(uuid)}/fs/raw?${qs}`, {
          method: "PUT",
          credentials: "include",
          body: file,
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text.trim() || res.statusText);
        }
        setUploadProgress((current) =>
          current.map((item) =>
            item.id === taskID ? { ...item, value: 100, uploadedBytes: file.size } : item,
          ),
        );
        onCompleteRef.current(normalizeRemotePath(destination));
        if (!uploadOptions.silent) {
          toast.success(t("file_manager.upload_complete", "Upload complete"));
        }
        return true;
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          toast.error(t("file_manager.upload_failed", "Upload failed"));
        }
        return false;
      } finally {
        abortControllersRef.current.delete(taskID);
        window.setTimeout(() => removeProgress(taskID), 800);
      }
    },
    [options, removeProgress, t, uuid],
  );

  const uploadFile = useCallback(
    async (file: File, destination: string) => {
      if (!uuid || !file) return;
      await uploadOne(file, destination, file.name);
    },
    [uploadOne, uuid],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[], destination: string) => {
      for (const file of Array.from(files)) {
        await uploadOne(file, destination, file.name);
      }
    },
    [uploadOne, uuid],
  );

  const uploadBlob = useCallback(
    async (blob: Blob, targetPath: string, uploadOptions?: RemoteUploadOptions) => {
      if (!uuid || !blob) return false;
      const normalizedPath = normalizeRemotePath(targetPath);
      return uploadOne(blob, remoteDirname(normalizedPath), remoteBasename(normalizedPath), uploadOptions);
    },
    [uploadOne, uuid],
  );

  const cancelUpload = useCallback((taskID?: string) => {
    if (taskID) {
      abortControllersRef.current.get(taskID)?.abort();
      return;
    }
    for (const controller of abortControllersRef.current.values()) {
      controller.abort();
    }
  }, []);

  return {
    uploadProgress,
    uploadFile,
    uploadFiles,
    uploadBlob,
    cancelUpload,
  };
};

export default useRemoteFileUpload;
