import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { supabase } from './supabaseClient';

function App() {
  const [fecha, setFecha] = useState(new Date());
  const [cancionesTotales, setCancionesTotales] = useState([]);
  const [planDelDia, setPlanDelDia] = useState([]);
  const [director, setDirector] = useState("");

  // 1. Cargar canciones de la tabla 'songs'
  useEffect(() => {
    async function cargarDatos() {
      const { data } = await supabase.from('songs').select('*');
      setCancionesTotales(data || []);
    }
    cargarDatos();
  }, []);

  // 2. Agregar canción a la lista temporal
  const agregarAlPlan = (cancion) => {
    if (!planDelDia.find(c => c.id === cancion.id)) {
      setPlanDelDia([...planDelDia, cancion]);
    }
  };

  // 3. Guardar en la tabla 'planes_culto'
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
      <h1 style={{ color: '#3b82f6', textAlign: 'center' }}>🎸 Odre Nuevo: Gestión de Cultos</h1>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        
        {/* SECCIÓN CALENDARIO */}
        <div style={{ flex: '1', minWidth: '300px', backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '15px' }}>
          <h3>1. Selecciona la Fecha</h3>
          <div style={{ color: '#000', display: 'flex', justifyContent: 'center' }}>
            <Calendar onChange={setFecha} value={fecha} />
          </div>
          <p style={{ marginTop: '15px', textAlign: 'center' }}>Día elegido: <strong>{fecha.toLocaleDateString()}</strong></p>
          
          <input 
            type="text" 
            placeholder="Nombre del Director" 
            value={director}
            onChange={(e) => setDirector(e.target.value)}
            style={{ width: '100%', padding: '12px', marginTop: '10px', borderRadius: '8px', border: 'none', fontSize: '16px' }}
          />
        </div>

        {/* SECCIÓN PLAN DEL DÍA */}
        <div style={{ flex: '1', minWidth: '300px', backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '15px' }}>
          <h3>2. Plan del Culto ({planDelDia.length})</h3>
          <div style={{ backgroundColor: '#222', padding: '10px', borderRadius: '10px', minHeight: '150px', marginBottom: '15px', border: '1px dashed #444' }}>
            {planDelDia.length === 0 && <p style={{ color: '#888', textAlign: 'center' }}>No hay canciones seleccionadas</p>}
            {planDelDia.map(c => (
              <div key={c.id} style={{ padding: '8px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
                <span>✅ {c.title}</span>
              </div>
            ))}
          </div>
          
          <button 
            onClick={guardarEnBaseDeDatos}
            style={{ width: '100%', padding: '15px', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
          >
            CONFIRMAR Y GUARDAR PLAN
          </button>

          <h3 style={{ marginTop: '25px' }}>3. Repertorio Disponible</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto', backgroundColor: '#111', borderRadius: '10px', padding: '10px' }}>
            {cancionesTotales.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid #222' }}>
                <span>{c.title}</span>
                <button 
                  onClick={() => agregarAlPlan(c)} 
                  style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 12px', cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;