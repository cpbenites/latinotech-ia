import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        if (req.method !== 'POST') {
            return Response.json({ error: 'Method not allowed' }, { status: 405 });
        }
        
        const payload = await req.json();
        const { email, language } = payload;
        
        if (!email || !email.includes('@') || !email.includes('.')) {
            return Response.json({ error: 'Por favor, introduce un correo electrónico válido.' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);
        
        const existing = await base44.asServiceRole.entities.Subscriber.filter({ email: email });
        
        if (existing.length > 0) {
            return Response.json({ error: '¡Este correo electrónico ya está suscrito!' }, { status: 400 });
        }
        
        await base44.asServiceRole.entities.Subscriber.create({
            email: email,
            language: language || 'es',
            active: true
        });

        return Response.json({ success: true, message: '¡Gracias por suscribirte!' });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});