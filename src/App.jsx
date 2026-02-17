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
      // IMPORTANTE: Si tu tabla no se llama 'songs', cambia 'songs' por el nombre real aquí abajo
      const { data, error } = await supabase.from('songs').select('*');
      if (error) console.error("Error cargando canciones:", error);
      else setCancionesTotales(data || []);
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

    if (error) alert("Error al guardar: " + error.message);
    else alert("¡Plan guardado con éxito para el " + fechaFormateada + "!");
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#3b82f6', textAlign: 'center' }}>🎸 Odre Nuevo: Gestión de Cultos</h1>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        
        {/* COLUMNA CALENDARIO */}
        <div style={{ flex: '1', minWidth: '300px', backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '15px' }}>
          <h3>1. Selecciona la Fecha</h3>
          <div style={{ color: '#000', borderRadius: '10px', overflow: 'hidden' }}>
            <Calendar onChange={setFecha} value={fecha} />
          </div>
          <p style={{ marginTop: '15px', textAlign: 'center' }}>Día elegido: <strong>{fecha.toLocaleDateString()}</strong></p>
          <input 
            type="text" 
            placeholder="Nombre del Director" 
            value={director}
            onChange={(e) => setDirector(e.target.value)}
            style={{ width: '92%', padding: '12px', marginTop: '10px', borderRadius: '8px', border: 'none' }}
          />
        </div>

        {/* COLUMNA PLAN Y REPERTORIO */}
        <div style={{ flex: '1', minWidth: '300px', backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '15px' }}>
          <h3>2. Plan del Culto ({planDelDia.length})</h3>
          <div style={{ backgroundColor: '#222', padding: '10px', borderRadius: '10px', minHeight: '100px', marginBottom: '15px' }}>
            {planDelDia.map(c => (
              <div key={c.id} style={{ padding: '8px', borderBottom: '1px solid #333' }}>
                ✅ {c.title} <span style={{ color: '#3b82f6', fontSize: '0.8em' }}>({c.key})</span>
              </div>
            ))}
          </div>
          
          <button onClick={guardarEnBaseDeDatos} style={{ width: '100%', padding: '15px', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>
            CONFIRMAR Y GUARDAR PLAN
          </button>

          <h3>3. Repertorio (Notas y Tonos)</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {cancionesTotales.map(c => (
              <div key={c.id} style={{ backgroundColor: '#222', margin: '10px 0', padding: '15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{c.title}</div>
                  <div style={{ color: '#3b82f6', fontSize: '0.9em' }}>Tono: {c.key} | Nota: {c.note}</div>
                </div>
                <button 
                  onClick={() => agregarAlPlan(c)} 
                  style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', fontSize: '20px' }}
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