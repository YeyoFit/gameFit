import { Resend } from 'resend';

// Initialize Resend with the API Key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(email: string, password: string) {
    const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://game-fit-one.vercel.app'; // Fallback to verified URL if env var is missing

    try {
        const { data, error } = await resend.emails.send({
            from: 'FitGame <onboarding@resend.dev>', // Default testing domain for Resend
            to: [email],
            subject: '¡Bienvenido a FitGame! Tus credenciales de acceso',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333; text-align: center;">¡Bienvenido a FitGame! 🏋️‍♂️</h2>
          <p style="color: #555; font-size: 16px;">Hola,</p>
          <p style="color: #555; font-size: 16px;">
            Tu cuenta ha sido creada exitosamente. A continuación encontrarás tus credenciales para acceder a la plataforma:
          </p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>URL:</strong> <a href="${loginUrl}" style="color: #0070f3;">${loginUrl}</a></p>
            <p style="margin: 5px 0;"><strong>Usuario (Email):</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Contraseña:</strong> <code>${password}</code></p>
          </div>

          <p style="color: #555; font-size: 14px;">
            Por favor, inicia sesión y cambia tu contraseña lo antes posible si lo deseas.
          </p>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${loginUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acceder a FitGame</a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">
            Este es un mensaje automático, por favor no respondas a este correo.
          </p>
        </div>
      `,
        });

        if (error) {
            console.error('Error sending welcome email from service:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Unexpected error sending email:', error);
        return { success: false, error };
    }
}
