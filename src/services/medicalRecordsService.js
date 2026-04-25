import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

const COLLECTION = "medicalRecords";

export async function buscarProntuarios() {
  const snapshot = await getDocs(collection(db, COLLECTION));

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function buscarProntuarioPorConsulta(appointmentId) {
  const q = query(
    collection(db, COLLECTION),
    where("appointmentId", "==", appointmentId)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const item = snapshot.docs[0];

  return {
    id: item.id,
    ...item.data(),
  };
}

export async function salvarProntuarioConsulta(appointmentId, data) {
  const existente = await buscarProntuarioPorConsulta(appointmentId);

  if (existente) {
    const ref = doc(db, COLLECTION, existente.id);
    await updateDoc(ref, {
      ...data,
      appointmentId,
      updatedAt: new Date().toISOString(),
    });

    return existente.id;
  }

  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    appointmentId,
    createdAt: new Date().toISOString(),
  });

  return ref.id;
}