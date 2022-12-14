

RootsSettings = class extends BaseSettings{

    //override
    static async load_settings(){
        const data = await super.load_settings();

        this.update_gpu_info(data);
    }

    //override
    static update_settings_modal(models){
        super.update_settings_modal(models)

        const settings = GLOBAL.settings;
        $('#settings-exclusionmask-enable')
            .checkbox({onChange: _ => this.on_exmask_checkbox()})
            .checkbox(settings.exmask_enabled? 'check' : 'uncheck');
        if(models['exclusion_mask'])
            this.update_model_selection_dropdown(
                models['exclusion_mask'], settings.active_models['exclusion_mask'], $("#settings-exclusionmask-model")
            )
        if(models['tracking'])
            this.update_model_selection_dropdown(
                models['tracking'], settings.active_models['tracking'], $("#settings-tracking-model")
            )
    }


    //override
    static apply_settings_from_modal(){
        GLOBAL.settings.active_models['detection']      = $("#settings-active-model").dropdown('get value');
        GLOBAL.settings.active_models['exclusion_mask'] = $("#settings-exclusionmask-model").dropdown('get value');
        GLOBAL.settings.active_models['tracking']       = $("#settings-tracking-model").dropdown('get value');

        GLOBAL.settings.use_gpu                         = $('#settings-gpu-enable').checkbox('is checked')
    }

    static on_exmask_checkbox(){
        var enabled = $('#settings-exclusionmask-enable').checkbox('is checked');
        GLOBAL.settings.exmask_enabled = enabled;
        $("#settings-exclusionmask-model-field").toggle(enabled)
    }

    static update_gpu_info(data){
        if(data['available_gpu']){
            $('#settings-no-gpu-warning').hide()
            $('#settings-gpu-available-box').show()
            $('#settings-gpu-name').text(data['available_gpu'])
        } else {
            $('#settings-no-gpu-warning').show()                        //maybe just hide the whole gpu field?
            $('#settings-gpu-available-box').hide()
        }
        console.log(data.settings)
        $('#settings-gpu-enable').checkbox(!!data.settings['use_gpu']? 'check' : 'uncheck')
    }

    static async toggle(click_id){
        // Uppdate settings to chosen detection model
        if(document.getElementById(click_id+'-appliedtext').innerHTML === 'Apply Model'){
            GLOBAL.settings.active_models['detection'] = click_id
            this.dispatch_event()
            var settingsdata = deepcopy(GLOBAL.settings);
            var postdata     = JSON.stringify(settingsdata);
            $('#settings-ok-button').addClass('loading');
    
            $.post(`/settings`, postdata,).done( x => {
                $('#settings-dialog').modal('hide');
                console.log('Settings saved successfully:',x)
            }).fail( x => {
                console.error('Saving settings failed', x)
                $('body').toast({message:'Saving failed', class:'error'})
            }).always( _ => {
                $('#settings-ok-button').removeClass('loading');
            } );

        }

        // Untoggle all buttons visually 
        var allmodels = GLOBAL.available_models.detection;
        for (let i = 0; i < allmodels.length; i++) {
            var modelname = allmodels[i]['name'] 
            element = document.getElementById(modelname+'-appliedtext')
            if (element !=null) {
                $('#'+modelname+'-appliedtext').text("Apply Model")
                document.getElementById(modelname).style.backgroundColor = 'lightgray'
            }
          }

        // Toggle the button clicked on
        var element = document.getElementById(click_id);
        element.style.backgroundColor = element.style.backgroundColor === 'green' ? 'lightgray' : 'green'          
        $('#'+click_id+'-appliedtext').text(function(i, text){
            return text === "Apply Model" ? "Model Applied" : "Apply Model";
        })
    }

}