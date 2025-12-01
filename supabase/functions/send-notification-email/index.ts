import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface NotificationRequest {
  type: 'like' | 'comment';
  recipient_user_id: string;
  actor_user_id: string;
  activity_id: string;
  comment_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, recipient_user_id, actor_user_id, activity_id, comment_id }: NotificationRequest = await req.json();
    
    console.log('Processing notification:', { type, recipient_user_id, actor_user_id, activity_id });

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check user's email notification preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('email_on_like, email_on_comment')
      .eq('user_id', recipient_user_id)
      .single();

    if (prefsError) {
      console.error('Error fetching preferences:', prefsError);
      // If no preferences exist yet, create default ones and proceed
      if (prefsError.code === 'PGRST116') {
        console.log('No preferences found, creating defaults');
        const { error: insertError } = await supabase
          .from('notification_preferences')
          .insert({ user_id: recipient_user_id });
        
        if (insertError) {
          console.error('Error creating default preferences:', insertError);
        }
      }
    }

    // Check if user wants email notifications for this type
    if (prefs) {
      if (type === 'like' && !prefs.email_on_like) {
        console.log('User has disabled email notifications for likes');
        return new Response(JSON.stringify({ message: 'Email disabled for likes' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      if (type === 'comment' && !prefs.email_on_comment) {
        console.log('User has disabled email notifications for comments');
        return new Response(JSON.stringify({ message: 'Email disabled for comments' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // Get recipient email from auth.users
    const { data: { user: recipient }, error: recipientError } = await supabase.auth.admin.getUserById(recipient_user_id);
    
    if (recipientError || !recipient?.email) {
      console.error('Error fetching recipient:', recipientError);
      throw new Error('Recipient not found');
    }

    // Get actor's display name
    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', actor_user_id)
      .single();

    const actorName = actorProfile?.display_name || 'Someone';

    // Get activity details
    const { data: activity } = await supabase
      .from('activities')
      .select('title')
      .eq('id', activity_id)
      .single();

    const activityTitle = activity?.title || 'your activity';

    let subject: string;
    let htmlContent: string;
    const appUrl = 'https://tube-challenge.lovable.app';

    if (type === 'like') {
      subject = `${actorName} liked your activity`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 0;">
                  <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="padding: 40px 30px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                          <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">❤️ New Like</h1>
                        </div>
                        <div style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                          <p style="margin: 0 0 20px;"><strong>${actorName}</strong> liked your activity <strong>${activityTitle}</strong>!</p>
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="${appUrl}/activities/${activity_id}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">View Activity</a>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 20px 30px; background-color: #f8f8f8; border-top: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0; color: #888; font-size: 13px; text-align: center;">
                          You're receiving this because you have email notifications enabled. 
                          <a href="${appUrl}/profile/settings" style="color: #007bff; text-decoration: none;">Manage preferences</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;
    } else {
      // Get comment content
      let commentContent = '';
      if (comment_id) {
        const { data: comment } = await supabase
          .from('activity_comments')
          .select('content')
          .eq('id', comment_id)
          .single();
        
        commentContent = comment?.content || '';
      }

      const commentPreview = commentContent.length > 100 
        ? commentContent.substring(0, 100) + '...' 
        : commentContent;

      subject = `${actorName} commented on your activity`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 0;">
                  <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="padding: 40px 30px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                          <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">💬 New Comment</h1>
                        </div>
                        <div style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                          <p style="margin: 0 0 20px;"><strong>${actorName}</strong> commented on your activity <strong>${activityTitle}</strong>:</p>
                          <div style="background-color: #f8f8f8; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #007bff;">
                            <p style="margin: 0; color: #333; font-style: italic;">"${commentPreview}"</p>
                          </div>
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="${appUrl}/activities/${activity_id}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">View Activity</a>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 20px 30px; background-color: #f8f8f8; border-top: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0; color: #888; font-size: 13px; text-align: center;">
                          You're receiving this because you have email notifications enabled. 
                          <a href="${appUrl}/profile/settings" style="color: #007bff; text-decoration: none;">Manage preferences</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;
    }

    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'TubeChallenge <notifications@antareez.com>',
      to: [recipient.email],
      subject,
      html: htmlContent,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      throw emailError;
    }

    console.log('Email sent successfully:', emailData);

    return new Response(JSON.stringify({ success: true, emailId: emailData?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in send-notification-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
