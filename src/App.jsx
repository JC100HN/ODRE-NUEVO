import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: ITEM DEL PLAN (ORDENABLE) ---
function ItemSortable({ c, cancionAbierta, setCancionAbierta, quitarDelSetlist }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const [misSemitonos, setMisSemitonos] = useState(0);
  const estaAbierta = cancionAbierta === c.id;

  const transponerIndividual = (texto, cantidad) => {
    if (!texto || cantidad === 0) return texto;
    try { return Transposer.transpose(texto).up(cantidad).toString(); } 
    catch (e) { return texto; }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.6 : 1,
    marginBottom: '8px',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: '#111',
    touchAction: 'none'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={estaAbierta ? estilos.headerActivo : estilos.headerNormal}>
        <div style={estilos.infoCuerpo} onClick={() => setCancionAbierta(estaAbierta ? null : c.id)}>
          <span {...attributes} {...listeners} style={estilos.manubrio}>☰</span>
          <div style={{display: 'flex', flexDirection: 'column'}}>
            <span style={{fontSize: '0.85rem', color: '#fff'}}>{c.titulo} <b style={{color: '#4da6ff'}}>{transponerIndividual(c.tono || c.key, misSemitonos)}</b></span>
            <small style={{color: '#888', fontSize: '0.65rem'}}>{c.artista || 'Artista'}</small>
          </div>
        </div>
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
          <div style={estilos.transporte}>
            <button onClick={(e) => { e.stopPropagation(); setMisSemitonos(s => s - 1); }} style={estilos.btnT}>-</button>
            <span style={{fontSize: '0.7rem'}}>{misSemitonos}</span>
            <button onClick={(e) => { e.stopPropagation(); setMisSemitonos(s => s + 1); }} style={estilos.btnT}>+</button>
          </div>
          <button onClick={(e) => { e.stopPropagation(); quitarDelSetlist(c.id); }} style={estilos.btnX}>×</button>
        </div>
      </div>
      {estaAbierta && (
        <div style={estilos.contenido}>
          <pre style={estilos.letraPre}>{transponerIndividual(c.letra || c.lyrics, misSemitonos)}</pre>
        </div>
      )}
    </div>
  );
}

// --- APP PRINCIPAL ---
export default function App() {
  const [fecha, setFecha] = useState(new Date());
  const [director, setDirector] = useState("");
  const [canciones, setCanciones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cancionAbierta, setCancionAbierta] = useState(null);
  const [setlist, setSetlist] = useState([]);
  const [existePlan, setExistePlan] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fechaLegible = fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    const cargarDatos = async () => {
      const { data } = await supabase.from('CANCIONES').select('*').order('titulo', { ascending: true });
      if (data) setCanciones(data.map((c, i) => ({ ...c, id: c.id || `id-${i}` })));
    };
    cargarDatos();
  }, []);

  useEffect(() => {
    const cargarPlan = async () => {
      const fechaISO = fecha.toISOString().split('T')[0];
      const { data } = await supabase.from('planes_culto').select('*').eq('fecha', fechaISO).maybeSingle();
      if (data) {
        setDirector(data.director || "");
        setSetlist(data.canciones || []);
        setExistePlan(true);
      } else {
        setDirector("");
        setSetlist([]);
        setExistePlan(false);
      }
    };
    cargarPlan();
  }, [fecha]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setSetlist((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const guardar = async () => {
    const fechaISO = fecha.toISOString().split('T')[0];
    const { error } = await supabase.from('planes_culto').upsert({ fecha: fechaISO, director, canciones: setlist });
    if (error) alert("Error: " + error.message);
    else { alert("¡Plan guardado!"); setExistePlan(true); }
  };

  const borrarPlan = async () => {
    if (window.confirm(`¿Seguro que quieres borrar el plan del ${fechaLegible}?`)) {
      const fechaISO = fecha.toISOString().split('T')[0];
      const { error } = await supabase.from('planes_culto').delete().eq('fecha', fechaISO);
      if (error) alert("Error: " + error.message);
      else {
        alert("Plan eliminado");
        setSetlist([]);
        setDirector("");
        setExistePlan(false);
      }
    }
  };

  const compartirWhatsApp = () => {
    let texto = `🎸 *ODRE NUEVO - PLAN DE CULTO*\n📅 *Fecha:* ${fechaLegible}\n👤 *Director:* ${director || 'No asignado'}\n\n*LISTA DE CANCIONES:*\n`;
    setlist.forEach((c, index) => {
      texto += `${index + 1}. ${c.titulo.toUpperCase()} (${c.tono || c.key})\n`;
    });
    texto += `\n_Preparémonos para adorar con excelencia._`;
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };

  return (
    <div style={estilos.fondo}>
      <h2 style={estilos.logo}>🎸 Odre Nuevo</h2>
      
      <div style={estilos.cajaBlanca}>
        <Calendar onChange={setFecha} value={fecha} className="mini-cal" />
        <div style={{marginTop: '10px', width: '100%', display: 'flex', justifyContent: 'center'}}>
          <input type="text" placeholder="Nombre del Director..." value={director} 
                 onChange={(e) => setDirector(e.target.value)} style={estilos.inputDir} />
        </div>
      </div>

      <input type="text" placeholder="🔍 Buscar alabanza o artista..." value={busqueda} 
             onChange={(e) => setBusqueda(e.target.value)} style={estilos.search} />

      <div style={{maxWidth: '500px', margin: '0 auto'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <h4 style={estilos.seccionTitle}>PLAN: <span style={{color: '#fff', textTransform: 'capitalize'}}>{fechaLegible}</span></h4>
            {setlist.length > 0 && (
                <button onClick={compartirWhatsApp} style={estilos.btnWhatsApp}>📱</button>
            )}
        </div>
        
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {setlist.map(c => (
              <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta}
                            quitarDelSetlist={(id) => setSetlist(setlist.filter(x => x.id !== id))} />
            ))}
          </SortableContext>
        </DndContext>

        <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
          <button onClick={guardar} style={estilos.btnG}>💾 GUARDAR</button>
          {existePlan && <button onClick={borrarPlan} style={estilos.btnBorrar}>🗑️</button>}
        </div>

        <div style={estilos.divisor}>BIBLIOTECA</div>
        {canciones.filter(c => (c.titulo + c.artista).toLowerCase().includes(busqueda.toLowerCase())).map(c => (
          <div key={c.id} style={estilos.itemRepo}>
            <div style={{flex: 1}}>
              <div style={{fontSize: '0.85rem', fontWeight: 'bold'}}>{c.titulo}</div>
              <div style={{fontSize: '0.65rem', color: '#666'}}>{c.artista || 'Artista'}</div>
            </div>
            <button onClick={() => setSetlist([...setlist, {...c, id: Date.now()}])} style={estilos.btnP}>+</button>
          </div>
        ))}
      </div>

      <style>{`
        .mini-cal { 
          width: 100% !important; 
          border: none !important; 
          font-family: sans-serif; 
          font-size: 0.8rem !important;
        }
        .react-calendar__tile {
          padding: 8px 4px !important;
          font-size: 0.75rem;
        }
        .react-calendar__tile--active { background: #3b82f6 !important; border-radius: 5px; color: white !important; }
        .react-calendar__month-view__days__day--neighboringMonth { color: #ccc !important; }
      `}</style>
    </div>
  )
}

const estilos = {
  fondo: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '15px', fontFamily: 'sans-serif' },
  logo: { textAlign: 'center', color: '#4da6ff', marginBottom: '15px', fontWeight: 'bold' },
  cajaBlanca: { background: '#fff', padding: '10px', borderRadius: '15px', marginBottom: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  inputDir: { width: '100%', maxWidth: '280px', padding: '10px', borderRadius: '8px', border: '2px solid #3b82f6', color: '#000', fontSize: '0.9rem', textAlign: 'center' },
  search: { width: '100%', padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '10px', marginBottom: '15px', boxSizing: 'border-box' },
  seccionTitle: { color: '#4da6ff', fontSize: '0.75rem', letterSpacing: '1px', margin: 0 },
  btnWhatsApp: { background: '#25D366', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerNormal: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#161616' },
  headerActivo: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#1e3a8a' },
  infoCuerpo: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  manubrio: { cursor: 'grab', fontSize: '1.2rem', color: '#444' },
  transporte: { display: 'flex', alignItems: 'center', gap: '5px', background: '#000', padding: '2px 8px', borderRadius: '15px' },
  btnT: { background: 'none', border: 'none', color: '#4da6ff', fontSize: '1.1rem', fontWeight: 'bold' },
  btnX: { background: 'none', border: 'none', color: '#ef4444', fontSize: '1.3rem' },
  contenido: { padding: '15px', background: '#050505' },
  letraPre: { whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#ccc', fontFamily: 'monospace' },
  btnG: { flex: 4, padding: '15px', background: '#10b981', border: 'none', borderRadius: '10px', fontWeight: 'bold', color: '#fff' },
  btnBorrar: { flex: 1, padding: '15px', background: '#333', border: 'none', borderRadius: '10px', color: '#fff' },
  divisor: { textAlign: 'center', margin: '30px 0 15px', color: '#333', fontSize: '0.6rem', fontWeight: 'bold', letterSpacing: '2px' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#111', borderRadius: '10px', marginBottom: '6px', border: '1px solid #222' },
  btnP: { background: '#3b82f6', border: 'none', color: '#fff', width: '35px', height: '35px', borderRadius: '50%', fontWeight: 'bold' }
}