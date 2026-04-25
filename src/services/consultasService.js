import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";

const COLLECTION = "consultas";

export async function buscarConsultas() {
  const q = query(collection(db, COLLECTION), orderBy("data", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function criarConsulta(data) {
  const docRef = await addDoc(collection(db, COLLECTION), data);
  return docRef.id;
}

export async function atualizarConsulta(id, data) {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, data);
}