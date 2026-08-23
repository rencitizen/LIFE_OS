revoke execute on function public.register_chatgpt_bucket_list_item(uuid,text,text,text,text) from authenticated;
revoke execute on function public.update_chatgpt_bucket_list_item(uuid,uuid,jsonb,text) from authenticated;
revoke execute on function public.delete_chatgpt_bucket_list_item(uuid,uuid,boolean,text) from authenticated;

grant execute on function public.register_chatgpt_bucket_list_item(uuid,text,text,text,text) to service_role;
grant execute on function public.update_chatgpt_bucket_list_item(uuid,uuid,jsonb,text) to service_role;
grant execute on function public.delete_chatgpt_bucket_list_item(uuid,uuid,boolean,text) to service_role;
