

RootDetectionDownload = class extends BaseDownload{
    //override
    static async zipdata_for_file(filename){
        var f                           = GLOBAL.files[filename];
        if(!f.results)
            return undefined;
        
        var zipdata                     = {};
        var segmentation                = f.results.segmentation
        var skeleton                    = f.results.skeleton
        zipdata[`${segmentation.name}`] = segmentation
        zipdata[`${skeleton.name}`]     = skeleton
        zipdata[`statistics.csv`]       = await this.csv_data_for_file(filename)
        return zipdata;
    }

    //override
    static async zipdata_for_files(filenames){
        var zipdata      = await super.zipdata_for_files(filenames)
        var combined_csv = ''
        for(var i in filenames){
            var single_csv = await this.csv_data_for_file(filenames[i], i==0)
            if(single_csv!=undefined)
                combined_csv += single_csv;
        }
        if(combined_csv.length > 0)
            zipdata['statistics.csv'] = combined_csv;
        return zipdata;
    }

    static async csv_data_for_file(filename, header=true){
        var csvtxt = '';

        var ex_mask = false
        // Get the detection model name that was used to process the images
        var det_modname = GLOBAL.files[filename].results.statistics.detection_model
        // Get metadata about the model to add in the csv-file
        var det_model_info = await $.get('/modelinformation_download', {training_type: 'detection', modelname: det_modname})
        var det_author = det_model_info['author']
        var det_ecosystem = det_model_info['ecosystem']
        var det_samp_dep = det_model_info['sampling-depth']
        var det_ex_treat = det_model_info['ex-treatment']
        var det_dom_species = det_model_info['dom-species']
        var det_soiltype = det_model_info['soiltype']

        if (GLOBAL.files[filename].results.statistics['exclusion_mask'] != undefined){
            var ex_modname = GLOBAL.files[filename].results.statistics['exclusion_mask']
            // Get metadata about the model to add in the csv-file
            var ex_model_info = await $.get('/modelinformation_download', {training_type: 'exclusion_mask', modelname: ex_modname})
            var ex_author = ex_model_info['author']
            var ex_ecosystem = ex_model_info['ecosystem']
            var ex_samp_dep = ex_model_info['sampling-depth']
            var ex_ex_treat = ex_model_info['ex-treatment']
            var ex_dom_species = ex_model_info['dom-species']
            var ex_soiltype = ex_model_info['soiltype']
            var add_data = [
                ex_modname, ex_author, ex_ecosystem, ex_samp_dep, ex_ex_treat, ex_dom_species, ex_soiltype
            ].join(',')
            ex_mask = true
        }
        if(header){
            csvtxt += 'Filename, '
                + '# root pixels, # background pixels, '
                + '# mask pixels, # skeleton pixels, '
                + '# skeleton pixels (<3px width), # skeleton pixels (3-7px width), # skeleton pixels (>7px width),'
                + 'Kimura length,'
                + 'Detection model used,'
                + 'Det. model-Author,'
                + 'Det. model-Ecosystem,'
                + 'Det. model-Sampling depth,'
                + 'Det. model-Experimental treatment,'
                + 'Det. model-Dominant species,'
                + 'Det. model-Soiltype,'
                + 'Date,'
                + 'Exclusion mask model name,'
                + 'Ex. mask-Author,'
                + 'Ex. mask-Ecosystem,'
                + 'Ex. mask-Sampling depth,'
                + 'Ex. mask-Experimental treatment,'
                + 'Ex. mask-Dominant species,'
                + 'Ex. mask-Soiltype;\n';

        }
        
        var f = GLOBAL.files[filename]
        if(!f.results)
            return;
        
        var stats = f.results.statistics;
        csvtxt   += [
            filename,
            stats.sum,       stats.sum_negative,
            stats.sum_mask,  stats.sum_skeleton, 
            stats.widths[0], stats.widths[1], stats.widths[2],
            stats.kimura_length,
            stats.detection_model,//GLOBAL.settings.active_models.detection
            det_author,
            det_ecosystem,
            det_samp_dep,
            det_ex_treat,
            det_dom_species,
            det_soiltype,
            stats.date,
        ].join(', ')

        if (ex_mask){
            csvtxt += ', ' + add_data + ';\n'
        }
        else {
            csvtxt += ',,,,,,,;\n'
        }

        return csvtxt;
    }
}



RootTrackingDownload = class extends BaseDownload {
    //override
    static async zipdata_for_file(filename){
        var $root     = $(`[filename0][filename1][filename="${filename}"]`)
        if($root.length==0) //should not happen
            return;
        
        var filename0     = $root.attr('filename0')
        var filename1     = $root.attr('filename1')
        var tracking_data = GLOBAL.files[filename0].tracking_results[filename1];
        if(tracking_data==undefined)
            return;

        var zipdata  = {};
        zipdata[tracking_data.growthmap]     = fetch_as_blob(url_for_image(tracking_data.growthmap))
        zipdata[tracking_data.segmentation0] = fetch_as_blob(url_for_image(tracking_data.segmentation0))
        zipdata[tracking_data.segmentation1] = fetch_as_blob(url_for_image(tracking_data.segmentation1))
        var jsondata = {
            filename0 : filename0,
            filename1 : filename1,
            points0   : tracking_data.points0,
            points1   : tracking_data.points1,
            n_matched_points   : tracking_data.n_matched_points,
            tracking_model     : tracking_data.tracking_model,
            segmentation_model : tracking_data.segmentation_model,
        }
        zipdata[`${filename0}.${filename1}.json`] = JSON.stringify(jsondata);
        zipdata[`${filename0}.${filename1}.csv`]  = await this.csv_data_statistics(filename0, filename1)
        return zipdata;
    }

    //override
    static async on_download_all(event){
        var filenames          = Object.keys(GLOBAL.files)
        var filenames_combined = []
        var filenames_pairs    = []
        for(var filename0 of filenames){
            var tracking_results = GLOBAL.files[filename0].tracking_results
            if(tracking_results == undefined)
                continue;
            for(var filename1 of Object.keys(tracking_results))
                if(Object.keys(tracking_results[filename1]).length>0){
                    filenames_combined.push(`${filename0}.${filename1}`)
                    filenames_pairs.push([filename0, filename1])
                }
        }

        var zipdata = await this.zipdata_for_files(filenames_combined)
        var combined_csv = ''
        for(var i in filenames_combined){
            var single_csv = await this.csv_data_statistics(...filenames_pairs[i], i==0)
            if(single_csv!=undefined)
                combined_csv += single_csv;
        }
        if(combined_csv.length > 0)
            zipdata['statistics.csv'] = combined_csv;

        if(Object.keys(zipdata).length==0)
            return
        download_zip('tracking_results.zip', zipdata)
    }


    static async csv_data_statistics(filename0, filename1, include_header=true){
        var stats = GLOBAL.files[filename0].tracking_results[filename1].statistics;

        var track_modname = stats.tracking_model

        var header = [
            'Filename 1',           'Filename 2', 
            'same pixels',          'decay pixels',          'growth pixels',
            'background pixels',    'mask pixels',
            'same skeleton pixels', 'decay skeleton pixels', 'growth skeleton pixels',
            'same kimura length',   'decay kimura length',   'growth kimura length',
            'Tracking model',       'Date'
        ]
        var data   = [
            filename0,         filename1,    
            stats.sum_same,    stats.sum_decay,    stats.sum_growth,
            stats.sum_negative,stats.sum_exmask,
            stats.sum_same_sk, stats.sum_decay_sk, stats.sum_growth_sk,
            stats.kimura_same, stats.kimura_decay, stats.kimura_growth,
            track_modname,           stats.date,
        ]

        if (GLOBAL.files[filename0].tracking_results[filename1].statistics['exclusion_mask'] != undefined){
            var ex_modname = GLOBAL.files[filename0].tracking_results[filename1].statistics['exclusion_mask']
            // Get metadata about the model to add in the csv-file
            var ex_model_info = await $.get('/modelinformation_download', {training_type: 'exclusion_mask', modelname: ex_modname})
            var ex_author = ex_model_info['author']
            var ex_ecosystem = ex_model_info['ecosystem']
            var ex_samp_dep = ex_model_info['sampling-depth']
            var ex_ex_treat = ex_model_info['ex-treatment']
            var ex_dom_species = ex_model_info['dom-species']
            var ex_soiltype = ex_model_info['soiltype']

            var add_data = [
                ex_modname, ex_author, ex_ecosystem, ex_samp_dep, ex_ex_treat, ex_dom_species, ex_soiltype,
            ]
            console.log(data)
        } else {
            var add_data = ["","","","","","",""]
        }

        var add_header = [
            'Exclusion mask model name', 'Ex. mask-Author', 'Ex. mask-Ecosystem', 'Ex. mask-Sampling depth',
            'Ex. mask-Experimental treatment', 'Ex. mask-Dominant species', 'Ex. mask-Soiltype'
        ]
        header = header.concat(add_header)
        data = data.concat(add_data)

        //sanity check
        if(header.length != data.length){
            console.error('CSV data length mismatch:', header, data)
            $('body').toast({message:'CSV data length mismatch', class:'error'})
            return;
        }

        return (include_header? [header] : []).concat([data.join(', '), '']).join(';\n')
    }
}
