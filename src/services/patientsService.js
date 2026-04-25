import { db } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

const COLLECTION = "patients";

export async function buscarPacientes() {
  const q = query(collection(db, COLLECTION), orderBy("nome", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function criarPaciente(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: new Date().toISOString(),
  });

  return ref.id;
}

export async function atualizarPaciente(id, data) {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function excluirPaciente(id) {
  const ref = doc(db, COLLECTION, id);
  await deleteDoc(ref);
}