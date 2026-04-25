import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const COLLECTION = "users";

export async function buscarUsuarios() {
  const q = query(collection(db, COLLECTION), orderBy("nome", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function criarUsuarioSistema({
  nome,
  email,
  senha,
  role,
  permissions,
  ativo,
}) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);

  const userDoc = {
    nome,
    email,
    role,
    permissions,
    ativo,
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, COLLECTION, cred.user.uid), userDoc);

  return {
    id: cred.user.uid,
    ...userDoc,
  };
}

export async function atualizarUsuarioSistema(id, data) {
  const ref = doc(db, COLLECTION, id);

  await updateDoc(ref, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}