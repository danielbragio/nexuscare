export const ESPECIALIDADES_MEDICO = [
  "Clínico Geral",
  "Cardiologia",
  "Dermatologia",
  "Endocrinologia",
  "Gastroenterologia",
  "Geriatria",
  "Ginecologia e Obstetrícia",
  "Neurologia",
  "Oftalmologia",
  "Ortopedia e Traumatologia",
  "Otorrinolaringologia",
  "Pediatria",
  "Psiquiatria",
  "Reumatologia",
  "Urologia",
  "Medicina de Família e Comunidade",
  "Medicina do Trabalho",
  "Medicina de Emergência",
  "Infectologia",
  "Oncologia",
  "Pneumologia",
  "Cirurgia Geral",
];

export const ESPECIALIDADES_ODONTO = [
  "Clínico Geral",
  "Ortodontia",
  "Endodontia",
  "Periodontia",
  "Implantodontia",
  "Cirurgia Bucomaxilofacial",
  "Odontopediatria",
  "Prótese Dentária",
  "Dentística",
  "Radiologia Odontológica",
];

// Especialidades exclusivamente odontológicas (sem "Clínico Geral" que aparece em ambas)
// Usado para roteamento automático: se selecionada → destino = odonto
export const ESPECIALIDADES_ODONTO_EXCLUSIVAS = new Set(
  ESPECIALIDADES_ODONTO.filter((e) => !ESPECIALIDADES_MEDICO.includes(e))
);
