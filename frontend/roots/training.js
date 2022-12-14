

RootsTraining = class extends BaseTraining {

    //override
    static refresh_tab(){
        super.refresh_tab()
        this.update_number_of_training_files_info()
    }
    
    //dummy override: all files selected  //TODO: move upstream
    // filtrerar bort de filer som är uppladdade men inte är processed? byt till GLOBAL.trainingfiles
    // ta bort filtreringen
    static get_selected_files(){
        const files_with_results = Object.values(GLOBAL.trainingfiles).filter( x => !!x.results)
        return files_with_results.map(x => x.name)
    }
    // testa hämta antalet evaluation bilder
    static get_nr_images(){
        console.log($('#nr_evaluation_images'))
        var $nr_ev_files = $('#nr_evaluation_images')
        console.log($nr_ev_files.get(0).value)
        console.log(GLOBAL.trainingfiles)
        return $nr_ev_files.get(0).value
    }

    // Moves files from training to evaluation
    static add_evaluation_files(NrEvalFiles){
        GLOBAL.evaluationfiles = []
        var filenames = this.get_selected_files()
        // Perform as many times as the number of files we want to put aside for evaluation
       for (let i = 0; i<NrEvalFiles; i++){
            // Pick a random training file
            var RandNum = Math.floor(Math.random() *filenames.length);
            // Move this file from training to evaluation
            GLOBAL.evaluationfiles[filenames[RandNum]] = GLOBAL.trainingfiles[filenames[RandNum]];
            delete GLOBAL.trainingfiles[filenames[RandNum]];
            filenames.splice(RandNum,1);
        }   
    }

    // Put evaluation files back into training files
    static move_evaluation_to_training_files(){
        // Filenames
        var filenames = Object.keys(GLOBAL.evaluationfiles);
       for (var i = 0; i < filenames.length;i++){
            var f = filenames[i]
            // Move to training
            GLOBAL.trainingfiles[f] = GLOBAL.evaluationfiles[f]
        }   
    }
    // Show different text on upload button depending on which model type
    static which_upload_button_to_show(event){
        var model_type = event.target.value
        //var $upload_anno_button = $('#upload_anno_button')
        var $text_ground_truth = $('#ground_truth_button_text')
        var $infotext_anno = $('#text_annotation_files')

        // If detection model is chosen
        if (model_type == 'detection'){
           // $upload_anno_button.toggle(true)
            $text_ground_truth.text('Upload Annotated Training Images')
            $infotext_anno.text('Upload corresponding annotated images to the training images')
            GLOBAL.model_type = 'detection';
        }
        // If exclusion mask model is chosen
        else if (model_type == 'exclusion_mask'){
           // $upload_anno_button.toggle(true)
            $text_ground_truth.text('Upload Exclusion Mask Images')
            $infotext_anno.text('Upload corresponding exclusion mask images to the training images')
            GLOBAL.model_type = 'exclusion_mask';
        }
    }

    // Show how many evaluation images after you have added ground truth images
    static show_nr_ev_images_section(){
        $('#nr_ev_image_box').toggle(true)
    }


    // override
    static async on_start_training() {
        GLOBAL.showmodal = 0
        //Move evaluation images from trainingfiles
        var NrEvalFiles = this.get_nr_images();
        this.add_evaluation_files(NrEvalFiles);
        var options = this.get_training_options();
        // Store starting point model
        var startingpoint = GLOBAL.settings.active_models[options.training_type]
        var filenames = this.get_selected_files()
        console.log('Training on ', filenames)
        
        const progress_cb = (m => this.on_training_progress(m))
        try {
            this.show_modal()

            $(GLOBAL.event_source).on('training', progress_cb)
            //FIXME: success/fail should not be determined by this request
            await $.post('/training', JSON.stringify({filenames:filenames, options:this.get_training_options()}))
            if(!$('#training-modal .ui.progress').progress('is complete'))
                this.interrupted_modal()
            
            GLOBAL.App.Settings.load_settings()
        } catch (e) {
            console.error(e)
            this.fail_modal()
        } finally {
            // Remove evaluation files so they can be used again for training
            this.move_evaluation_to_training_files()    
            // Only update and display the modal if training was successful
            if (GLOBAL.showmodal) {
                $(GLOBAL.event_source).off('training', progress_cb)
                if (NrEvalFiles > 0) {      
                    try {
                        await this.setup_evaluation(startingpoint, NrEvalFiles)
                        }
                        catch (e) {
                            console.error(e)   
                        }
                }
                //Show results modal
                this.settings_save_modal(NrEvalFiles)
            } else {
                this.on_discard_model()
            }
        }
    }   

    static async setup_evaluation(startingpoint, NrEvalFiles) {

        // Evaluate training
        var evalfiles = this.get_selected_evaluation_files()
        var results = await $.post('/evaluation', JSON.stringify({ filenames: evalfiles, startingpoint: startingpoint, options: this.get_training_options() }))

        // Update evaluation data table.
        RootsEvaluation.update_evaluation_results_info(NrEvalFiles, results)
    }

    // Set actions for discard and save model buttons and show save model modal
    static settings_save_modal(NrEvalFiles) {
        $('#evaluation-modal').addClass('disabled').modal('hide')
        $('#save-modal').modal({closable: false, inverted:true, duration : 0,}).modal('show')

        // Refresh errormap filetable and reset text and boxes if empty.
        if (NrEvalFiles == 0) {
            GLOBAL.evaluationfiles = []
            $('thead th#evaluation_errormap_files').text(`No Evaluation Images Used`)
            $('#evaluation-results-box').addClass('hidden')
            $('#evaluation-results-message').addClass('hidden')
        }
        $('.tabs .item[data-tab="training"]').click()
        RootsEvaluation.refresh_errormap_filetable(Object.values(GLOBAL.evaluationfiles))
    }

    //override
    static get_training_options(){
        const training_type = $('#training-model-type').dropdown('get value');
        return {
            training_type       : training_type,
            learning_rate       : Number($('#training-learning-rate')[0].value),
            epochs              : Number($('#training-number-of-epochs')[0].value),
        };
    }

    //override
    static update_model_info(){
        const model_type  = $('#training-model-type').dropdown('get value');
        if(!model_type)
            return;
        
        super.update_model_info(model_type)
    }

    //override
    static success_modal() {
        $('#training-modal .progress').progress('set success', 'Training finished');
        $('#training-modal #ok-training-button').show()
        $('#training-modal #cancel-training-button').hide()
        this.hide_modal()
        var NrEvalFiles = this.get_nr_images();
        if (NrEvalFiles > 0) {
            $('#evaluation-modal').modal({
                closable: false, inverted: true,
            }).modal('show');
        }
        // If training is successful, show the modal.
        GLOBAL.showmodal = 1
    }

    static update_number_of_training_files_info(){
        const n = this.get_selected_files().length;
        $('#training-number-of-files-info-label').text(n)
        $('#training-number-of-files-info-message').removeClass('hidden')
        // Set the top limit of evaluation images that can be chosen in the text
        $('#nr_training_images').text(Math.floor(n - 1))
        // Pick out the object where we choose how many evaluation pictures we want
        var $nr_ev_images = $('#nr_evaluation_images').get(0)
        // Set maximum number of evaluation pictures that can be chosen
        $nr_ev_images.max = Math.floor(n - 1)
        // 25% of training data or a bit less is the default-value for evaluation
        $nr_ev_images.value = Math.floor(n * 0.25)

    }
    
    // Set annotated files as result for an original file
    static async set_results(filename, results){
//        var clear = (results == undefined)   
//        if(results && is_string(results.segmentation))
//            results.segmentation = await fetch_as_file(url_for_image(results.segmentation))
//        var segmentation = clear? undefined : results.segmentation;
        GLOBAL.trainingfiles[filename].set_results(results)       
    }

    static get_selected_evaluation_files(){
        const eval_files = Object.values(GLOBAL.evaluationfiles) //.filter( x => !!x.results )
        return eval_files.map( x => x.name)
    }

    // Get information about model that user want to save
    static on_save_settings(){
        // Close evaluation modal and open settings for the saved model 
        $('#save-modal').modal('hide')
        var $save_settings_modal = $('#save-settings-modal').modal({closable: false, inverted:true, duration : 0,})
        $save_settings_modal.modal('show')
    }


    static get_model_information(){
        // Save information about new model in dictionary
        var info_dict = {}
        info_dict['author'] = $('#training-author').get(0).value
        info_dict['ecosystem'] = $('#ecosystem').get(0).value
        info_dict['sampling-depth'] = $('#sampling-depth').get(0).value
        info_dict['ex-treatment'] = $('#ex-treatment').get(0).value
        info_dict['dom-species'] = $('#dom-species').get(0).value
        info_dict['soiltype'] = $('#soiltype').get(0).value
        info_dict['notes'] = $('#notes').get(0).value
        console.log(info_dict)
        if (info_dict['author'] == "" || info_dict['ecosystem'] == "" || info_dict['sampling-depth'] == ""
            || info_dict['ex-treatment'] == "" || info_dict['dom-species'] == "" || info_dict['soiltype'] == ""){
            return null
        }
        return info_dict

    }

    // override
    static async on_save_model(){
        // Save information about new model in dictionary
        var info_dict = RootsTraining.get_model_information()
        console.log(info_dict)
        var storefiles = this.get_selected_files()
        if (info_dict != null ){
            const new_modelname = $('#training-new-modelname')[0].value
            console.log('Saving new model as:', new_modelname)
            await $.post('/save_model',  JSON.stringify({newname: new_modelname, options:RootsTraining.get_training_options(),filenames:storefiles, info:info_dict}))    // this.get_training_options
                .done( _ => {
                    $('#training-new-modelname-field').hide() 
                    GLOBAL.App.Settings.load_settings() // Reload settings
                    $('#save-settings-modal').modal('hide')

                    console.log(GLOBAL.model_type)
                    if (GLOBAL.model_type == 'detection') {
                        this.update_model_list(true)
                    }
                })
                .fail( _ => $('body').toast({message:'Saving failed.', class:'error', displayTime: 0, closeIcon: true}) )
            $('#training-new-modelname')[0].value = ''
            $('#save-settings-form').form('clear')   
        }
    }

    // Updates model list when user saves new model.
    static async update_model_list(popup=false) {

        // Refresh Allinfo
        if (popup) {
            var all_info = await $.post('/refresh_allinfo')
                .done(_ => $('body').toast({ message: 'Model has been added to the gallery.', class: 'success', displayTime: 0, closeIcon: true }))
                .fail(_ => $('body').toast({ message: 'Model was not added to the gallery.', class: 'error', displayTime: 0, closeIcon: true }))
        } else {
            var all_info = await $.post('/refresh_allinfo')
        }

        // Fetch model list html container and clear it.
        var $model_list = $('#model-selection');
        $model_list.find('model-list').remove()
        $model_list.append("<model-list></model-list>")

        // Loop over Allinfo, fetch model template and append to list.
        for (let info of all_info['Allinfo']) {
            var model_element = $("template#model-selection-template").tmpl([{ info: info }])

            // Loop over model example images and append them to model_element
            for (let i = 0; i < info["training_images"].length; i++) {
                var model_element_image = $("template#model-selection-template-images").tmpl([{ training_image: info["training_images"][i] }])
                $(model_element_image).appendTo($(model_element).find('model-list-image'))
            }

            $(model_element).appendTo($model_list.find('model-list'))
        }
    }

    // Discards trained model, removes it and sets a new active model 
    static on_discard_model(){
        console.log('Discarding model')
        $.get('/discard_model',{options:RootsTraining.get_training_options()})
            .done( _ => {
                $('#training-new-modelname-field').hide();
                GLOBAL.App.Settings.load_settings();
                $('#save-modal').modal('hide');
                $('#save-settings-modal').modal('hide');
                $('#save-settings-form').form('clear');
            })
            .fail( _ => $('body').toast({message:'Discarding model failed.', class:'error', displayTime: 0, closeIcon: true}) );
        $('#training-new-modelname')[0].value = '';
    }    
}



