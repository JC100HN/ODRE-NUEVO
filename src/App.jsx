import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { supabase } from './supabaseClient';

function App() {
const [fecha, setFecha] = useState(new Date());
const [cancionesTotales, setCancionesTotales] = useState([]);
const [planDelDia, setPlanDelDia] = useState([]);
const [director, setDirector] = useState("");

useEffect(() => {
async function cargarDatos() {
const { data } = await supabase.from('songs').select('*');
setCancionesTotales(data || []);
}
cargarDatos();
}, []);

const agregarAlPlan = (cancion) => {
if (!planDelDia.find(c => c.id === cancion.id)) {
setPlanDelDia([...planDelDia, cancion]);
}
};

const guardarEnBaseDeDatos = async () => {
const fechaFormateada = fecha.toISOString().split('T')[0];
const { error } = await supabase
.from('planes_culto')
.upsert({
fecha: fechaFormateada,
director: director,
canciones: planDelDia
});

if (error) {
  alert("Error al guardar: " + error.message);
} else {
  alert("¡Plan guardado con éxito para el día " + fechaFormateada + "!");
}
};

return (
<div style={{ padding: '20px', backgroundColor: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
<h1 style={{ color: '#3b82f6' }}>🎸 Odre Nuevo: - V2</h1>

  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
    <div style={{ flex: '1', minWidth: '300px', backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '15px' }}>
      <h3>1. Selecciona la Fecha</h3>
      <div style={{ color: '#000' }}>
        <Calendar onChange={setFecha} value={fecha} />
      </div>
      <p style={{ marginTop: '10px' }}>Día elegido: {fecha.toLocaleDateString()}</p>
      
      <input 
        type="text" 
        placeholder="Nombre del Director" 
        value={director}
        onChange={(e) => setDirector(e.target.value)}
        style={{ width: '100%', padding: '10px', marginTop: '10px', borderRadius: '5px' }}
      />
    </div>

    <div style={{ flex: '1', minWidth: '300px' }}>
      <h3>2. Plan del Culto ({planDelDia.length})</h3>
      <div style={{ backgroundColor: '#222', padding: '10px', borderRadius: '10px', minHeight: '100px', marginBottom: '10px' }}>
        {planDelDia.map(c => (
          <div key={c.id} style={{ padding: '5px', borderBottom: '1px solid #444' }}>✅ {c.title}</div>
        ))}
      </div>
      <button 
        onClick={guardarEnBaseDeDatos}
        style={{ width: '100%', padding: '15px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
      >
        GUARDAR PLAN EN CALENDARIO
      </button>

      <h3 style={{ marginTop: '20px' }}>3. Agregar Canciones</h3>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {cancionesTotales.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #333' }}>
            <span>{c.title}</span>
            <button onClick={() => agregarAlPlan(c)} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 10px' }}>+</button>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>
);
export default App;
}