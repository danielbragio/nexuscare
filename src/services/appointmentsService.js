import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

const COLLECTION = "appointments";

export async function buscarConsultas() {
  const q = query(collection(db, COLLECTION), orderBy("data", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function criarConsulta(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: new Date().toISOString(),
  });

  return ref.id;
}

export async function atualizarConsulta(id, data) {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}